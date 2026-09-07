import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { ScriptSchema } from "../render/script-schema.js";
import { createRenderJobManager, type PipelineRunner } from "./job-manager.js";
import type { ScriptGenerator } from "./script-generator.js";
import type { SourceResolver } from "./source-input.js";
import { createMobileApiServer } from "./server.js";

const tempDirs: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function loadFixtureScript() {
  const raw = JSON.parse(await readFile(join(process.cwd(), "tests", "fixtures", "sample-script-no-image.json"), "utf8"));
  return ScriptSchema.parse(raw);
}

async function startServer(
  runner: PipelineRunner,
  generation?: { sourceResolver: SourceResolver; scriptGenerator: ScriptGenerator },
  writeToken?: string,
  liveActivityPush?: { pushEnabled: boolean; register(jobID: string, token: string, locale: string): boolean },
) {
  const outputRoot = await mkdtemp(join(tmpdir(), "auto-video-gen-api-"));
  tempDirs.push(outputRoot);
  const manager = createRenderJobManager({ outputRoot, runPipeline: runner });
  const server = createMobileApiServer(manager, generation, { writeToken, liveActivityPush });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function waitForStatus(baseUrl: string, id: string, expected: string) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/v1/render-jobs/${id}`);
    const body = await response.json() as { status: string };
    if (body.status === expected) return body;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for status ${expected}`);
}

describe("createMobileApiServer", () => {
  it("validates scripts, runs a render job, and serves video.mp4", async () => {
    const runner: PipelineRunner = async (scriptPath, options) => {
      options?.onProgress?.({ step: 5, total: 8, message: "Audio" });
      await writeFile(join(dirname(scriptPath), "video.mp4"), "video-bytes");
    };
    const baseUrl = await startServer(runner);

    const invalid = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: { nope: true } }),
    });
    expect(invalid.status).toBe(400);

    const createdResponse = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: await loadFixtureScript() }),
    });
    expect(createdResponse.status).toBe(202);
    const created = await createdResponse.json() as { id: string; status: string };
    expect(created.status).toBe("queued");

    const completed = await waitForStatus(baseUrl, created.id, "completed") as { videoUrl?: string };
    expect(completed.videoUrl).toBe(`/v1/render-jobs/${created.id}/video`);

    const video = await fetch(`${baseUrl}${completed.videoUrl}`);
    expect(video.status).toBe(200);
    expect(video.headers.get("content-type")).toBe("video/mp4");
    expect(video.headers.get("accept-ranges")).toBe("bytes");
    expect(video.headers.get("content-length")).toBe("11");
    expect(await video.text()).toBe("video-bytes");

    const partial = await fetch(`${baseUrl}${completed.videoUrl}`, {
      headers: { range: "bytes=2-6" },
    });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 2-6/11");
    expect(partial.headers.get("content-length")).toBe("5");
    expect(await partial.text()).toBe("deo-b");

    const head = await fetch(`${baseUrl}${completed.videoUrl}`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("accept-ranges")).toBe("bytes");
    expect(head.headers.get("content-length")).toBe("11");
    expect(await head.text()).toBe("");

    const invalidRange = await fetch(`${baseUrl}${completed.videoUrl}`, {
      headers: { range: "bytes=50-60" },
    });
    expect(invalidRange.status).toBe(416);
    expect(invalidRange.headers.get("content-range")).toBe("bytes */11");
  });

  it("generates a script from a mobile source request before queuing the existing render job", async () => {
    const fixture = await loadFixtureScript();
    const runner: PipelineRunner = async (scriptPath) => {
      await writeFile(join(dirname(scriptPath), "video.mp4"), "generated-video");
    };
    const sourceResolver = {
      resolve: async () => ({
        sourceKind: "Text" as const,
        title: "Input title",
        text: "Input body",
        source: { url: "", domain: "local", image: null },
      }),
    } satisfies SourceResolver;
    const scriptGenerator = {
      generate: async () => fixture,
    } satisfies ScriptGenerator;
    const baseUrl = await startServer(runner, { sourceResolver, scriptGenerator });

    const response = await fetch(`${baseUrl}/v1/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceKind: "Text", content: "Input title\nInput body" }),
    });
    expect(response.status).toBe(202);
    const created = await response.json() as { id: string; title: string };
    expect(created.title).toBe(fixture.metadata.title);

    const completed = await waitForStatus(baseUrl, created.id, "completed") as { videoUrl?: string };
    expect(completed.videoUrl).toBe(`/v1/render-jobs/${created.id}/video`);
  });

  it("returns 503 for source generation when no provider is configured", async () => {
    const baseUrl = await startServer(async () => {});
    const response = await fetch(`${baseUrl}/v1/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceKind: "Text", content: "hello" }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "source_generation_not_configured" });
  });

  it("requires the configured bearer token for write endpoints", async () => {
    const fixture = await loadFixtureScript();
    const baseUrl = await startServer(async () => {}, undefined, "physical-device-token");

    const unauthorized = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: fixture }),
    });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toBe("Bearer");
    expect(await unauthorized.json()).toEqual({ error: "unauthorized" });

    const authorized = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: {
        authorization: "Bearer physical-device-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ script: fixture }),
    });
    expect(authorized.status).toBe(202);
  });

  it("registers authenticated Live Activity push tokens for an existing job", async () => {
    const registrations: Array<{ jobID: string; token: string; locale: string }> = [];
    const liveActivityPush = {
      pushEnabled: true,
      register(jobID: string, token: string, locale: string) {
        registrations.push({ jobID, token, locale });
        return true;
      },
    };
    const runner: PipelineRunner = async (scriptPath) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      await writeFile(join(dirname(scriptPath), "video.mp4"), "video");
    };
    const baseUrl = await startServer(runner, undefined, "physical-device-token", liveActivityPush);
    const createdResponse = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: {
        authorization: "Bearer physical-device-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ script: await loadFixtureScript() }),
    });
    const created = await createdResponse.json() as { id: string };
    const token = "ab".repeat(32);

    const unauthorized = await fetch(`${baseUrl}/v1/render-jobs/${created.id}/live-activity-token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(unauthorized.status).toBe(401);

    const registered = await fetch(`${baseUrl}/v1/render-jobs/${created.id}/live-activity-token`, {
      method: "POST",
      headers: {
        authorization: "Bearer physical-device-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token, locale: "vi" }),
    });
    expect(registered.status).toBe(202);
    expect(await registered.json()).toEqual({ ok: true, pushEnabled: true });
    expect(registrations).toEqual([{ jobID: created.id, token, locale: "vi" }]);
  });

  it("accepts Live Activity tokens while remote APNs publishing is disabled", async () => {
    const registrations: string[] = [];
    const liveActivityPush = {
      pushEnabled: false,
      register(_jobID: string, token: string, _locale: string) {
        registrations.push(token);
        return true;
      },
    };
    const runner: PipelineRunner = async (scriptPath) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      await writeFile(join(dirname(scriptPath), "video.mp4"), "video");
    };
    const baseUrl = await startServer(runner, undefined, "physical-device-token", liveActivityPush);
    const createdResponse = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: {
        authorization: "Bearer physical-device-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ script: await loadFixtureScript() }),
    });
    const created = await createdResponse.json() as { id: string };
    const token = "cd".repeat(32);
    const registered = await fetch(`${baseUrl}/v1/render-jobs/${created.id}/live-activity-token`, {
      method: "POST",
      headers: {
        authorization: "Bearer physical-device-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    expect(registered.status).toBe(202);
    expect(await registered.json()).toEqual({ ok: true, pushEnabled: false });

    const emptyLocaleToken = "ce".repeat(32);
    const emptyLocale = await fetch(`${baseUrl}/v1/render-jobs/${created.id}/live-activity-token`, {
      method: "POST",
      headers: {
        authorization: "Bearer physical-device-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: emptyLocaleToken, locale: "" }),
    });
    expect(emptyLocale.status).toBe(202);
    expect(registrations).toEqual([token, emptyLocaleToken]);
  });

  it("rejects unsupported Live Activity locales", async () => {
    const liveActivityPush = {
      pushEnabled: true,
      register() { return true; },
    };
    const runner: PipelineRunner = async (scriptPath) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      await writeFile(join(dirname(scriptPath), "video.mp4"), "video");
    };
    const baseUrl = await startServer(runner, undefined, "physical-device-token", liveActivityPush);
    const createdResponse = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: {
        authorization: "Bearer physical-device-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ script: await loadFixtureScript() }),
    });
    const created = await createdResponse.json() as { id: string };
    const response = await fetch(`${baseUrl}/v1/render-jobs/${created.id}/live-activity-token`, {
      method: "POST",
      headers: {
        authorization: "Bearer physical-device-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: "ef".repeat(32), locale: "de" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_live_activity_locale" });
  });

  it("holds the wait endpoint until a job reaches a terminal state", async () => {
    const runner: PipelineRunner = async (scriptPath) => {
      await new Promise((resolve) => setTimeout(resolve, 35));
      await writeFile(join(dirname(scriptPath), "video.mp4"), "video");
    };
    const baseUrl = await startServer(runner);
    const createdResponse = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: await loadFixtureScript() }),
    });
    const created = await createdResponse.json() as { id: string };

    const waited = await fetch(`${baseUrl}/v1/render-jobs/${created.id}/wait`);
    expect(waited.status).toBe(200);
    const terminal = await waited.json() as { status: string; videoReady: boolean; videoUrl?: string };
    expect(terminal.status).toBe("completed");
    expect(terminal.videoReady).toBe(true);
    expect(terminal.videoUrl).toBe(`/v1/render-jobs/${created.id}/video`);
  });

  it("streams current and terminal job states over SSE", async () => {
    const runner: PipelineRunner = async (scriptPath, options) => {
      options?.onProgress?.({ step: 7, total: 8, message: "Render" });
      await new Promise((resolve) => setTimeout(resolve, 20));
      await writeFile(join(dirname(scriptPath), "video.mp4"), "video");
    };
    const baseUrl = await startServer(runner);
    const createdResponse = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: await loadFixtureScript() }),
    });
    const created = await createdResponse.json() as { id: string };

    const events = await fetch(`${baseUrl}/v1/render-jobs/${created.id}/events`);
    expect(events.status).toBe(200);
    expect(events.headers.get("content-type")).toContain("text/event-stream");
    const text = await events.text();
    expect(text).toContain("\"status\":\"running\"");
    expect(text).toContain("\"status\":\"completed\"");
  });
});