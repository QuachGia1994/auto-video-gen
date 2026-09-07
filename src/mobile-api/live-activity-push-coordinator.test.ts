import { describe, expect, it } from "vitest";
import { liveActivityStateFor } from "./live-activity-push-coordinator.js";
import type { RenderJobSnapshot } from "./job-manager.js";

function snapshot(overrides: Partial<RenderJobSnapshot>): RenderJobSnapshot {
  return {
    id: "job",
    title: "Title",
    sceneCount: 6,
    voice: "edge-tts",
    status: "running",
    videoReady: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("liveActivityStateFor", () => {
  it("maps render fraction into overall job progress", () => {
    expect(liveActivityStateFor(snapshot({
      progress: { step: 7, total: 8, message: "Capturing frame 300/1000", fraction: 0.4 },
    }))).toEqual({
      progress: 0.8,
      phase: "Rendering frames",
      completed: false,
      failed: false,
    });
  });

  it("maps completed jobs to terminal ready state", () => {
    expect(liveActivityStateFor(snapshot({ status: "completed", videoReady: true }))).toEqual({
      progress: 1,
      phase: "Ready to review",
      completed: true,
      failed: false,
    });
  });

  it("maps failed jobs without pretending completion", () => {
    const state = liveActivityStateFor(snapshot({
      status: "failed",
      progress: { step: 7, total: 8, message: "Render", fraction: 0.5 },
    }));
    expect(state.failed).toBe(true);
    expect(state.completed).toBe(false);
    expect(state.phase).toBe("Render stopped");
    expect(state.progress).toBeLessThan(1);
  });
});
