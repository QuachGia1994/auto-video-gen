import type { RenderJobSnapshot, createRenderJobManager } from "./job-manager.js";
import type { LiveActivityContentState, LiveActivityPushPublisher } from "./apns-live-activity.js";
import { log } from "../utils/logger.js";

type RenderJobManager = ReturnType<typeof createRenderJobManager>;

type RegisteredActivity = {
  token: string;
  unsubscribe: () => void;
  lastProgress: number;
  lastPhase: string;
  lastPushAt: number;
  latest?: RenderJobSnapshot;
  timer?: NodeJS.Timeout;
  chain: Promise<void>;
};

const MIN_PUSH_INTERVAL_MS = 2_500;
const MIN_PROGRESS_DELTA = 0.02;

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function phaseFor(snapshot: RenderJobSnapshot) {
  if (snapshot.status === "completed") return "Ready to review";
  if (snapshot.status === "failed") return "Render stopped";
  const message = snapshot.progress?.message?.trim();
  if (!message) return snapshot.status === "queued" ? "Queued" : "Processing";
  if (/capturing frame/i.test(message)) return "Rendering frames";
  if (/encoding video/i.test(message)) return "Encoding video";
  if (/assembling/i.test(message)) return "Assembling video";
  return message;
}

export function liveActivityStateFor(snapshot: RenderJobSnapshot): LiveActivityContentState {
  if (snapshot.status === "completed") {
    return { progress: 1, phase: "Ready to review", completed: true, failed: false };
  }

  const total = Math.max(snapshot.progress?.total ?? 8, 1);
  const step = Math.min(Math.max(snapshot.progress?.step ?? 1, 1), total);
  const inner = step >= total
    ? 1
    : step === 7
      ? clamp(snapshot.progress?.fraction ?? 0)
      : 0;
  const progress = clamp(((step - 1) + inner) / total);
  return {
    progress,
    phase: phaseFor(snapshot),
    completed: false,
    failed: snapshot.status === "failed",
  };
}

export function createLiveActivityPushCoordinator(
  manager: RenderJobManager,
  publisher: LiveActivityPushPublisher,
) {
  const registrations = new Map<string, RegisteredActivity>();

  const enqueue = (jobID: string, snapshot: RenderJobSnapshot, force = false) => {
    const record = registrations.get(jobID);
    if (!record) return;
    const state = liveActivityStateFor(snapshot);
    const terminal = snapshot.status === "completed" || snapshot.status === "failed";
    const now = Date.now();
    const phaseChanged = state.phase !== record.lastPhase;
    const progressed = Math.abs(state.progress - record.lastProgress) >= MIN_PROGRESS_DELTA;
    const intervalElapsed = now - record.lastPushAt >= MIN_PUSH_INTERVAL_MS;

    if (!force && !terminal && !phaseChanged && !progressed) return;
    if (!force && !terminal && !intervalElapsed) {
      record.latest = snapshot;
      if (!record.timer) {
        record.timer = setTimeout(() => {
          record.timer = undefined;
          const latest = record.latest;
          record.latest = undefined;
          if (latest) enqueue(jobID, latest, true);
        }, MIN_PUSH_INTERVAL_MS - (now - record.lastPushAt));
      }
      return;
    }

    if (record.timer) {
      clearTimeout(record.timer);
      record.timer = undefined;
      record.latest = undefined;
    }
    record.lastPushAt = now;
    record.lastProgress = state.progress;
    record.lastPhase = state.phase;
    const event = terminal ? "end" as const : "update" as const;
    record.chain = record.chain.then(async () => {
      try {
        await publisher.send({ token: record.token, event, state, title: snapshot.title });
      } catch (error) {
        log.warn(`Live Activity APNs push failed for ${jobID}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
      if (terminal) {
        registrations.get(jobID)?.unsubscribe();
        registrations.delete(jobID);
      }
    });
  };

  return {
    register(jobID: string, token: string) {
      const job = manager.get(jobID);
      if (!job) return false;
      const existing = registrations.get(jobID);
      if (existing) {
        existing.token = token;
        enqueue(jobID, job, true);
        return true;
      }
      const record: RegisteredActivity = {
        token,
        unsubscribe: () => {},
        lastProgress: -1,
        lastPhase: "",
        lastPushAt: 0,
        chain: Promise.resolve(),
      };
      registrations.set(jobID, record);
      record.unsubscribe = manager.subscribe(jobID, (snapshot) => enqueue(jobID, snapshot));
      return true;
    },
    close() {
      for (const record of registrations.values()) {
        if (record.timer) clearTimeout(record.timer);
        record.unsubscribe();
      }
      registrations.clear();
      publisher.close();
    },
  };
}
