import { describe, expect, it } from "vitest";
import { createSourceResolver, type AddressResolver } from "./source-input.js";

const publicAddress: AddressResolver = async () => ["93.184.216.34"];

describe("createSourceResolver", () => {
  it("preserves local text and derives stable local metadata", async () => {
    const resolver = createSourceResolver({ resolveAddresses: publicAddress });
    const source = await resolver.resolve({ sourceKind: "Markdown", content: "# Headline\n\nBody **copy**" });

    expect(source.title).toBe("Headline");
    expect(source.text).toContain("Body **copy**");
    expect(source.source).toEqual({ url: "", domain: "local", image: null });
  });

  it("pins the validated public address when fetching a URL", async () => {
    const requests: Array<{ url: string; pinnedAddress: string }> = [];
    const resolver = createSourceResolver({
      resolveAddresses: publicAddress,
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), pinnedAddress: init.pinnedAddress });
        return new Response(`<!doctype html><html><head><title>Example story</title><meta property="og:image" content="/cover.jpg"></head><body><script>ignore()</script><article><h1>Example story</h1><p>Nội dung chính của bài viết.</p></article></body></html>`, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    });

    const source = await resolver.resolve({ sourceKind: "URL", content: "https://example.com/story" });

    expect(requests).toEqual([{ url: "https://example.com/story", pinnedAddress: "93.184.216.34" }]);
    expect(source.title).toBe("Example story");
    expect(source.text).toContain("Nội dung chính của bài viết.");
    expect(source.text).not.toContain("ignore() ");
    expect(source.source).toEqual({
      url: "https://example.com/story",
      domain: "example.com",
      image: "https://example.com/cover.jpg",
    });
  });

  it("drops a private og:image target from an otherwise public article", async () => {
    const resolver = createSourceResolver({
      resolveAddresses: async (hostname) => hostname === "example.com" ? ["93.184.216.34"] : ["127.0.0.1"],
      fetchImpl: async () => new Response(`<html><head><title>Safe page</title><meta property="og:image" content="http://internal.test/cover.jpg"></head><body><p>Public article body.</p></body></html>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    });

    const source = await resolver.resolve({ sourceKind: "URL", content: "https://example.com/story" });
    expect(source.source.image).toBeNull();
  });

  it("rejects invalid numeric HTML entities without crashing", async () => {
    const resolver = createSourceResolver({
      resolveAddresses: publicAddress,
      fetchImpl: async () => new Response(`<html><head><title>Entity &#x110000;</title></head><body><p>Body &#9999999; text.</p></body></html>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    });

    const source = await resolver.resolve({ sourceKind: "URL", content: "https://example.com/entity" });
    expect(source.title).toContain("&#x110000;");
    expect(source.text).toContain("&#9999999;");
  });

  it("rejects empty plain-text URL responses", async () => {
    const resolver = createSourceResolver({
      resolveAddresses: publicAddress,
      fetchImpl: async () => new Response("   \n", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    });

    await expect(resolver.resolve({ sourceKind: "URL", content: "https://example.com/empty" })).rejects.toThrow("no readable text");
  });

  it("rejects private targets before fetching", async () => {
    let fetched = false;
    const resolver = createSourceResolver({
      resolveAddresses: async () => ["127.0.0.1"],
      fetchImpl: async () => {
        fetched = true;
        return new Response("private");
      },
    });

    await expect(resolver.resolve({ sourceKind: "URL", content: "http://internal.test/secret" })).rejects.toThrow("public HTTP(S)");
    expect(fetched).toBe(false);
  });

  it("revalidates redirect destinations before following them", async () => {
    let fetchCount = 0;
    const resolver = createSourceResolver({
      resolveAddresses: async (hostname) => hostname === "example.com" ? ["93.184.216.34"] : ["10.0.0.5"],
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response(null, { status: 302, headers: { location: "http://internal.test/private" } });
      },
    });

    await expect(resolver.resolve({ sourceKind: "URL", content: "https://example.com/redirect" })).rejects.toThrow("public HTTP(S)");
    expect(fetchCount).toBe(1);
  });
});
