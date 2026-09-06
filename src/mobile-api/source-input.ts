import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import { z } from "zod";

const MAX_SOURCE_BYTES = 250_000;
const MAX_REDIRECTS = 5;

export type MobileSourceKind = "URL" | "Text" | "Markdown";

export const SourceRequestSchema = z.object({
  sourceKind: z.enum(["URL", "Text", "Markdown"]),
  content: z.string().min(1),
});

export type SourceRequest = z.infer<typeof SourceRequestSchema>;

export type SourceMetadata = {
  url: string;
  domain: string;
  image: string | null;
};

export type SourceDocument = {
  sourceKind: MobileSourceKind;
  title: string;
  text: string;
  source: SourceMetadata;
};

export type AddressResolver = (hostname: string) => Promise<string[]>;
type SourceFetchInit = RequestInit & { pinnedAddress: string };
type FetchLike = (input: URL, init: SourceFetchInit) => Promise<Response>;

const defaultAddressResolver: AddressResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

function utf8Size(value: string) {
  return new TextEncoder().encode(value).length;
}

function titleFromLocalText(content: string) {
  const first = content.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "Untitled video";
  return first.replace(/^#{1,6}\s+/, "").slice(0, 80);
}

function isPublicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0]!;
  if (normalized === "::" || normalized === "::1") return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return isPublicIpv4(mapped[1]!);
  const first = parseInt(normalized.split(":")[0] || "0", 16);
  if (!Number.isFinite(first)) return false;
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (normalized.startsWith("2001:db8:")) return false;
  return true;
}

function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

async function assertPublicHttpUrl(url: URL, resolveAddresses: AddressResolver) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Source URL must use public HTTP(S)");
  if (url.username || url.password) throw new Error("Source URL must not contain credentials");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Source URL must resolve to public HTTP(S)");
  }
  const addresses = await resolveAddresses(hostname);
  if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error("Source URL must resolve to public HTTP(S)");
  }
  return addresses;
}

const pinnedFetch: FetchLike = async (url, init) => new Promise<Response>((resolve, reject) => {
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const req = request(url, {
    method: init.method ?? "GET",
    headers,
    lookup: (_hostname, _options, callback) => callback(null, init.pinnedAddress, isIP(init.pinnedAddress)),
  }, (incoming) => {
    const responseHeaders = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) responseHeaders.append(name, item);
      } else if (value !== undefined) {
        responseHeaders.set(name, value);
      }
    }
    const body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
    resolve(new Response(body, { status: incoming.statusCode ?? 500, headers: responseHeaders }));
  });
  req.setTimeout(30_000, () => req.destroy(new Error("Source request timed out")));
  req.on("error", reject);
  req.end();
});

async function readResponseText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) throw new Error("Source document is too large");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("Source document is too large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x") || lower.startsWith("#")) {
      const radix = lower.startsWith("#x") ? 16 : 10;
      const digits = lower.slice(radix === 16 ? 2 : 1);
      const codePoint = parseInt(digits, radix);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return named[lower] ?? match;
  });
}

function metaContent(html: string, property: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi)) attrs.set(match[1]!.toLowerCase(), match[3]!);
    if ((attrs.get("property") ?? attrs.get("name"))?.toLowerCase() === property.toLowerCase()) return decodeHtmlEntities(attrs.get("content") ?? "").trim();
  }
  return "";
}

function htmlToDocument(html: string, url: URL): SourceDocument {
  const ogTitle = metaContent(html, "og:title");
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = decodeHtmlEntities(ogTitle || titleMatch?.[1] || url.hostname).replace(/\s+/g, " ").trim().slice(0, 120);
  const imageValue = metaContent(html, "og:image");
  let image: string | null = null;
  if (imageValue) {
    try {
      const imageUrl = new URL(imageValue, url);
      if (imageUrl.protocol === "http:" || imageUrl.protocol === "https:") image = imageUrl.toString();
    } catch {
      image = null;
    }
  }

  const text = decodeHtmlEntities(html
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|article|section|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  if (!text) throw new Error("Source URL returned no readable text");

  return {
    sourceKind: "URL",
    title: title || "Untitled video",
    text,
    source: { url: url.toString(), domain: url.hostname.replace(/^www\./, ""), image },
  };
}

export function createSourceResolver({
  fetchImpl = pinnedFetch,
  resolveAddresses = defaultAddressResolver,
}: {
  fetchImpl?: FetchLike;
  resolveAddresses?: AddressResolver;
} = {}) {
  const fetchUrl = async (initialUrl: URL) => {
    let current = initialUrl;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const addresses = await assertPublicHttpUrl(current, resolveAddresses);
      const response = await fetchImpl(current, {
        redirect: "manual",
        pinnedAddress: addresses[0]!,
        headers: { "user-agent": "AutoVideoGen/2 mobile-source-fetcher", accept: "text/html,text/plain,text/markdown;q=0.9" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`Source redirect ${response.status} has no location`);
        if (redirect === MAX_REDIRECTS) throw new Error("Source URL redirected too many times");
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new Error(`Source URL returned HTTP ${response.status}`);
      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("text/markdown") && !contentType.includes("application/xhtml+xml")) {
        throw new Error(`Unsupported source content type: ${contentType.split(";")[0]}`);
      }
      const body = await readResponseText(response);
      if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
        const document = htmlToDocument(body, current);
        if (document.source.image) {
          try {
            await assertPublicHttpUrl(new URL(document.source.image), resolveAddresses);
          } catch {
            document.source.image = null;
          }
        }
        return document;
      }
      const text = body.trim();
      if (!text) throw new Error("Source URL returned no readable text");
      return {
        sourceKind: "URL" as const,
        title: titleFromLocalText(text),
        text,
        source: { url: current.toString(), domain: current.hostname.replace(/^www\./, ""), image: null },
      };
    }
    throw new Error("Source URL redirected too many times");
  };

  return {
    async resolve(request: SourceRequest): Promise<SourceDocument> {
      const content = request.content.trim();
      if (!content) throw new Error("Source content is required");
      if (utf8Size(content) > MAX_SOURCE_BYTES) throw new Error("Source document is too large");
      if (request.sourceKind === "URL") {
        let url: URL;
        try {
          url = new URL(content);
        } catch {
          throw new Error("Source URL is invalid");
        }
        return fetchUrl(url);
      }
      return {
        sourceKind: request.sourceKind,
        title: titleFromLocalText(content),
        text: content,
        source: { url: "", domain: "local", image: null },
      };
    },
  };
}

export type SourceResolver = ReturnType<typeof createSourceResolver>;
