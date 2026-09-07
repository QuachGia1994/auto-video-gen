import { timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ScriptSchema } from "../render/script-schema.js";
import type { RenderJobSnapshot, createRenderJobManager } from "./job-manager.js";
import type { ScriptGenerator } from "./script-generator.js";
import { SourceRequestSchema, type SourceResolver } from "./source-input.js";

const MAX_BODY_BYTES = 1_000_000;

type RenderJobManager = ReturnType<typeof createRenderJobManager>;
type JsonResult = { ok: true; data: unknown } | { ok: false; status: number; error: string };

type MobileApiServerOptions = {
  writeToken?: string;
  liveActivityPush?: {
    pushEnabled: boolean;
    register(jobID: string, token: string): boolean;
  };
};

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<JsonResult> {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) return { ok: false, status: 413, error: "request_too_large" };
      chunks.push(buffer);
    }
    return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

function publicSnapshot(snapshot: RenderJobSnapshot) {
  return {
    ...snapshot,
    videoUrl: snapshot.videoReady ? `/v1/render-jobs/${snapshot.id}/video` : null,
  };
}

function matchJobPath(pathname: string) {
  const match = /^\/v1\/render-jobs\/([0-9a-f-]+)(?:\/(events|video|wait|live-activity-token))?$/.exec(pathname);
  if (!match) return null;
  return { id: match[1]!, action: match[2] ?? "status" } as const;
}

function hasValidWriteToken(request: IncomingMessage, expectedToken?: string) {
  if (!expectedToken) return true;
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return false;
  const actualToken = authorization.slice("Bearer ".length);
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(actualToken);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requireWriteAuthorization(request: IncomingMessage, response: ServerResponse, expectedToken?: string) {
  if (hasValidWriteToken(request, expectedToken)) return true;
  response.setHeader("www-authenticate", "Bearer");
  sendJson(response, 401, { error: "unauthorized" });
  return false;
}

export function createMobileApiServer(
  manager: RenderJobManager,
  generation?: { sourceResolver: SourceResolver; scriptGenerator: ScriptGenerator },
  options: MobileApiServerOptions = {},
) {
  return createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (method === "GET" && url.pathname === "/v1/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && url.pathname === "/v1/generate") {
      if (!requireWriteAuthorization(request, response, options.writeToken)) return;
      if (!generation) {
        sendJson(response, 503, { error: "source_generation_not_configured" });
        return;
      }
      const body = await readJsonBody(request);
      if (!body.ok) {
        sendJson(response, body.status, { error: body.error });
        return;
      }
      const sourceRequest = SourceRequestSchema.safeParse(body.data);
      if (!sourceRequest.success) {
        sendJson(response, 400, { error: "invalid_source_request", issues: sourceRequest.error.issues });
        return;
      }
      try {
        const source = await generation.sourceResolver.resolve(sourceRequest.data);
        const script = await generation.scriptGenerator.generate(source);
        const job = await manager.create(script);
        sendJson(response, 202, publicSnapshot(job));
      } catch (error) {
        sendJson(response, 422, {
          error: "source_generation_failed",
          message: error instanceof Error ? error.message : "Source generation failed",
        });
      }
      return;
    }

    if (method === "POST" && url.pathname === "/v1/render-jobs") {
      if (!requireWriteAuthorization(request, response, options.writeToken)) return;
      const body = await readJsonBody(request);
      if (!body.ok) {
        sendJson(response, body.status, { error: body.error });
        return;
      }
      const candidate = typeof body.data === "object" && body.data !== null && "script" in body.data
        ? (body.data as { script: unknown }).script
        : undefined;
      const parsed = ScriptSchema.safeParse(candidate);
      if (!parsed.success) {
        sendJson(response, 400, { error: "invalid_script", issues: parsed.error.issues });
        return;
      }
      try {
        const job = await manager.create(parsed.data);
        sendJson(response, 202, publicSnapshot(job));
      } catch {
        sendJson(response, 500, { error: "job_create_failed" });
      }
      return;
    }

    const jobPath = matchJobPath(url.pathname);
    if (!jobPath) {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    const job = manager.get(jobPath.id);
    if (!job) {
      sendJson(response, 404, { error: "job_not_found" });
      return;
    }

    if (method === "POST" && jobPath.action === "live-activity-token") {
      if (!requireWriteAuthorization(request, response, options.writeToken)) return;
      if (!options.liveActivityPush) {
        sendJson(response, 503, { error: "live_activity_registration_not_configured" });
        return;
      }
      const body = await readJsonBody(request);
      if (!body.ok) {
        sendJson(response, body.status, { error: body.error });
        return;
      }
      const token = typeof body.data === "object" && body.data !== null && "token" in body.data
        ? String((body.data as { token: unknown }).token).trim().toLowerCase()
        : "";
      if (!/^[0-9a-f]{32,512}$/.test(token) || token.length % 2 !== 0) {
        sendJson(response, 400, { error: "invalid_live_activity_token" });
        return;
      }
      const accepted = options.liveActivityPush.register(jobPath.id, token);
      if (!accepted) {
        sendJson(response, 409, { error: "live_activity_registration_rejected" });
        return;
      }
      sendJson(response, 202, { ok: true, pushEnabled: options.liveActivityPush.pushEnabled });
      return;
    }

    if (method === "GET" && jobPath.action === "status") {
      sendJson(response, 200, publicSnapshot(job));
      return;
    }

    if (method === "GET" && jobPath.action === "events") {
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      let unsubscribe: (() => void) | undefined;
      let terminalBeforeSubscriptionReturned = false;
      unsubscribe = manager.subscribe(jobPath.id, (snapshot) => {
        response.write(`data: ${JSON.stringify(publicSnapshot(snapshot))}\n\n`);
        if (snapshot.status === "completed" || snapshot.status === "failed") {
          if (unsubscribe) unsubscribe();
          else terminalBeforeSubscriptionReturned = true;
          response.end();
        }
      });
      if (terminalBeforeSubscriptionReturned) unsubscribe();
      request.on("close", () => unsubscribe?.());
      return;
    }

    if (method === "GET" && jobPath.action === "wait") {
      if (job.status === "completed" || job.status === "failed") {
        sendJson(response, 200, publicSnapshot(job));
        return;
      }
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      const heartbeat = setInterval(() => response.write("\n"), 15_000);
      let unsubscribe: (() => void) | undefined;
      unsubscribe = manager.subscribe(jobPath.id, (snapshot) => {
        if (snapshot.status !== "completed" && snapshot.status !== "failed") return;
        clearInterval(heartbeat);
        unsubscribe?.();
        response.end(JSON.stringify(publicSnapshot(snapshot)));
      });
      response.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe?.();
      });
      return;
    }

    if (method === "GET" && jobPath.action === "video") {
      const videoPath = manager.getVideoPath(jobPath.id);
      if (!videoPath) {
        sendJson(response, 409, { error: "video_not_ready" });
        return;
      }
      response.writeHead(200, { "content-type": "video/mp4" });
      const stream = createReadStream(videoPath);
      stream.on("error", () => response.destroy());
      stream.pipe(response);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
  });
}