import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import type { PipelineProgress, PipelineRunOptions } from "../pipeline.js";
import type { Script } from "../render/script-schema.js";

export type PipelineRunner = (scriptPath: string, options?: PipelineRunOptions) => Promise<void>;

export type RenderJobStatus = "queued" | "running" | "completed" | "failed";

export type RenderJobSnapshot = {
  id: string;
  title: string;
  sceneCount: number;
  voice: string;
  status: RenderJobStatus;
  progress?: PipelineProgress;
  error?: string;
  videoReady: boolean;
  createdAt: string;
  updatedAt: string;
};

type RenderJobRecord = RenderJobSnapshot & {
  scriptPath: string;
  videoPath: string;
};

type Listener = (snapshot: RenderJobSnapshot) => void;

export function createRenderJobManager({
  outputRoot,
  runPipeline,
  maxRetainedJobs = 50,
}: {
  outputRoot: string;
  runPipeline: PipelineRunner;
  maxRetainedJobs?: number;
}) {
  if (!Number.isInteger(maxRetainedJobs) || maxRetainedJobs < 1) throw new Error("maxRetainedJobs must be a positive integer");
  const jobs = new Map<string, RenderJobRecord>();
  const listeners = new Map<string, Set<Listener>>();
  const runOneAtATime = pLimit(1);

  const snapshotOf = (job: RenderJobRecord): RenderJobSnapshot => ({
    id: job.id,
    title: job.title,
    sceneCount: job.sceneCount,
    voice: job.voice,
    status: job.status,
    progress: job.progress,
    error: job.error,
    videoReady: job.videoReady,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });

  const publish = (job: RenderJobRecord) => {
    job.updatedAt = new Date().toISOString();
    const snapshot = snapshotOf(job);
    for (const listener of listeners.get(job.id) ?? []) listener(snapshot);
  };

  const evictOldTerminalJobs = async () => {
    while (jobs.size >= maxRetainedJobs) {
      let oldestTerminal: RenderJobRecord | undefined;
      for (const job of jobs.values()) {
        if (job.status === "completed" || job.status === "failed") {
          oldestTerminal = job;
          break;
        }
      }
      if (!oldestTerminal) throw new Error("Render queue is full");
      jobs.delete(oldestTerminal.id);
      listeners.delete(oldestTerminal.id);
      await rm(dirname(oldestTerminal.scriptPath), { recursive: true, force: true });
    }
  };

  const execute = async (job: RenderJobRecord) => {
    job.status = "running";
    publish(job);
    try {
      await runPipeline(job.scriptPath, {
        onProgress: (progress) => {
          job.progress = progress;
          publish(job);
        },
      });
      await access(job.videoPath);
      job.status = "completed";
      job.videoReady = true;
      job.progress = { step: 8, total: 8, message: "Done" };
    } catch (error) {
      job.status = "failed";
      job.videoReady = false;
      job.error = error instanceof Error ? error.message : "Render pipeline failed";
    }
    publish(job);
  };

  return {
    async create(script: Script): Promise<RenderJobSnapshot> {
      await evictOldTerminalJobs();
      const id = randomUUID();
      const jobDir = join(outputRoot, id);
      const scriptPath = join(jobDir, "script.json");
      const now = new Date().toISOString();
      await mkdir(jobDir, { recursive: true });
      await writeFile(scriptPath, JSON.stringify(script, null, 2), "utf8");

      const job: RenderJobRecord = {
        id,
        title: script.metadata.title,
        sceneCount: script.scenes.length,
        voice: script.voice.provider,
        status: "queued",
        videoReady: false,
        createdAt: now,
        updatedAt: now,
        scriptPath,
        videoPath: join(jobDir, "video.mp4"),
      };
      jobs.set(id, job);
      queueMicrotask(() => {
        void runOneAtATime(() => execute(job));
      });
      return snapshotOf(job);
    },

    get(id: string): RenderJobSnapshot | undefined {
      const job = jobs.get(id);
      return job ? snapshotOf(job) : undefined;
    },

    getVideoPath(id: string): string | undefined {
      const job = jobs.get(id);
      return job?.videoReady ? job.videoPath : undefined;
    },

    subscribe(id: string, listener: Listener): () => void {
      const job = jobs.get(id);
      if (!job) return () => {};
      const jobListeners = listeners.get(id) ?? new Set<Listener>();
      jobListeners.add(listener);
      listeners.set(id, jobListeners);
      listener(snapshotOf(job));
      return () => {
        jobListeners.delete(listener);
        if (jobListeners.size === 0) listeners.delete(id);
      };
    },
  };
}