import type { RenderJobSnapshot, createRenderJobManager } from "./job-manager.js";
import type { LiveActivityContentState, LiveActivityLocale, LiveActivityPushPublisher } from "./apns-live-activity.js";
import { log } from "../utils/logger.js";

type RenderJobManager = ReturnType<typeof createRenderJobManager>;

type RegisteredActivity = {
  token: string;
  unsubscribe: () => void;
  lastProgress: number;
  lastPushAt: number;
  locale: LiveActivityLocale;
  latest?: RenderJobSnapshot;
  timer?: NodeJS.Timeout;
  chain: Promise<void>;
};

const MIN_PUSH_INTERVAL_MS = 2_500;
const MIN_PROGRESS_DELTA = 0.02;

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function liveActivityStateFor(snapshot: RenderJobSnapshot): LiveActivityContentState {
  if (snapshot.status === "completed") {
    return { progress: 1, completed: true, failed: false };
  }

  const total = Math.max(snapshot.progress?.total ?? 8, 1);
  const step = Math.min(Math.max(snapshot.progress?.step ?? 1, 1), total);
  const inner = step >= total
    ? 1
    : step === total - 1
      ? clamp(snapshot.progress?.fraction ?? 0)
      : 0;
  const progress = clamp(((step - 1) + inner) / total);
  return {
    progress,
    completed: false,
    failed: snapshot.status === "failed",
  };
}

export function createLiveActivityPushCoordinator(
  manager: RenderJobManager,
  publisher?: LiveActivityPushPublisher,
) {
  const registrations = new Map<string, RegisteredActivity>();

  const enqueue = (jobID: string, snapshot: RenderJobSnapshot, force = false) => {
    const record = registrations.get(jobID);
    if (!record) return;
    const state = liveActivityStateFor(snapshot);
    const terminal = snapshot.status === "completed" || snapshot.status === "failed";
    const now = Date.now();
    const progressed = Math.abs(state.progress - record.lastProgress) >= MIN_PROGRESS_DELTA;
    const intervalElapsed = now - record.lastPushAt >= MIN_PUSH_INTERVAL_MS;

    if (!force && !terminal && !progressed) return;
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
    const event = terminal ? "end" as const : "update" as const;
    record.chain = record.chain.then(async () => {
      if (publisher) {
        try {
          await publisher.send({ token: record.token, event, state, title: snapshot.title, locale: record.locale });
        } catch (error) {
          log.warn(`Live Activity APNs push failed for ${jobID}: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }
      if (terminal) {
        registrations.get(jobID)?.unsubscribe();
        registrations.delete(jobID);
      }
    });
  };

  return {
    pushEnabled: Boolean(publisher),
    register(jobID: string, token: string, locale: LiveActivityLocale) {
      const job = manager.get(jobID);
      if (!job) return false;
      const existing = registrations.get(jobID);
      if (existing) {
        existing.token = token;
        existing.locale = locale;
        log.info(`Live Activity push token refreshed for ${jobID} (remote push ${publisher ? "enabled" : "disabled"})`);
        enqueue(jobID, job, true);
        return true;
      }
      const record: RegisteredActivity = {
        token,
        unsubscribe: () => {},
        lastProgress: -1,
        lastPushAt: 0,
        locale,
        chain: Promise.resolve(),
      };
      registrations.set(jobID, record);
      log.info(`Live Activity push token registered for ${jobID} (remote push ${publisher ? "enabled" : "disabled"})`);
      record.unsubscribe = manager.subscribe(jobID, (snapshot) => enqueue(jobID, snapshot));
      return true;
    },
    close() {
      for (const record of registrations.values()) {
        if (record.timer) clearTimeout(record.timer);
        record.unsubscribe();
      }
      registrations.clear();
      publisher?.close();
    },
  };
}
