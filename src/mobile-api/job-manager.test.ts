import { afterEach, describe, expect, it } from "vitest";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { ScriptSchema } from "../render/script-schema.js";
import { createRenderJobManager, type PipelineRunner, type RenderJobSnapshot } from "./job-manager.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function loadFixtureScript() {
  const raw = JSON.parse(await readFile(join(process.cwd(), "tests", "fixtures", "sample-script-no-image.json"), "utf8"));
  return ScriptSchema.parse(raw);
}

async function createTempOutputRoot() {
  const path = await mkdtemp(join(tmpdir(), "auto-video-gen-mobile-"));
  tempDirs.push(path);
  return path;
}

function waitForTerminal(manager: ReturnType<typeof createRenderJobManager>, id: string) {
  return new Promise<{ final: RenderJobSnapshot; seen: RenderJobSnapshot[] }>((resolve, reject) => {
    const seen: RenderJobSnapshot[] = [];
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for render job")), 2_000);
    let unsubscribe = () => {};
    unsubscribe = manager.subscribe(id, (snapshot) => {
      seen.push(snapshot);
      if (snapshot.status === "completed" || snapshot.status === "failed") {
        clearTimeout(timeout);
        unsubscribe();
        resolve({ final: snapshot, seen });
      }
    });
  });
}

describe("createRenderJobManager", () => {
  it("reports pipeline progress and completes when video.mp4 exists", async () => {
    const outputRoot = await createTempOutputRoot();
    const runner: PipelineRunner = async (scriptPath, options) => {
      options?.onProgress?.({ step: 3, total: 8, message: "TTS" });
      await Promise.resolve();
      options?.onProgress?.({ step: 7, total: 8, message: "Render" });
      await writeFile(join(dirname(scriptPath), "video.mp4"), "video");
    };
    const manager = createRenderJobManager({ outputRoot, runPipeline: runner });

    const created = await manager.create(await loadFixtureScript());
    expect(created.status).toBe("queued");

    const { final, seen } = await waitForTerminal(manager, created.id);
    expect(final.status).toBe("completed");
    expect(final.videoReady).toBe(true);
    expect(final.progress).toEqual({ step: 8, total: 8, message: "Done" });
    expect(seen.some((snapshot) => snapshot.progress?.step === 3)).toBe(true);
    expect(seen.some((snapshot) => snapshot.progress?.step === 7)).toBe(true);
  });

  it("evicts the oldest terminal job and its files at the retention cap", async () => {
    const outputRoot = await createTempOutputRoot();
    const runner: PipelineRunner = async (scriptPath) => {
      await writeFile(join(dirname(scriptPath), "video.mp4"), "video");
    };
    const manager = createRenderJobManager({ outputRoot, runPipeline: runner, maxRetainedJobs: 1 });
    const script = await loadFixtureScript();

    const first = await manager.create(script);
    await waitForTerminal(manager, first.id);
    const second = await manager.create(script);

    expect(manager.get(first.id)).toBeUndefined();
    await expect(access(join(outputRoot, first.id))).rejects.toThrow();
    expect(manager.get(second.id)?.status).toBeDefined();
  });

  it("stores a safe error when the pipeline fails", async () => {
    const outputRoot = await createTempOutputRoot();
    const runner: PipelineRunner = async () => {
      throw new Error("render exploded");
    };
    const manager = createRenderJobManager({ outputRoot, runPipeline: runner });

    const created = await manager.create(await loadFixtureScript());
    const { final } = await waitForTerminal(manager, created.id);

    expect(final.status).toBe("failed");
    expect(final.error).toBe("render exploded");
    expect(final.videoReady).toBe(false);
  });
});