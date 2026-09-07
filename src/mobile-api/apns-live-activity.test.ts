import { describe, expect, it } from "vitest";
import { buildLiveActivityPushPayload, loadAPNsLiveActivityConfig } from "./apns-live-activity.js";

describe("loadAPNsLiveActivityConfig", () => {
  it("stays disabled when no APNs credentials are configured", () => {
    expect(loadAPNsLiveActivityConfig({})).toBeUndefined();
  });

  it("loads token-key auth", () => {
    expect(loadAPNsLiveActivityConfig({
      APNS_AUTH_MODE: "token",
      APNS_ENVIRONMENT: "sandbox",
      APNS_BUNDLE_ID: "com.example.app",
      APNS_KEY_PATH: "AuthKey.p8",
      APNS_KEY_ID: "KEY123",
      APNS_TEAM_ID: "TEAM123",
    })).toEqual({
      authMode: "token",
      environment: "sandbox",
      bundleId: "com.example.app",
      keyPath: "AuthKey.p8",
      keyId: "KEY123",
      teamId: "TEAM123",
    });
  });

  it("loads certificate auth", () => {
    expect(loadAPNsLiveActivityConfig({
      APNS_AUTH_MODE: "certificate",
      APNS_P12_PATH: "push.p12",
      APNS_P12_PASSPHRASE: "secret",
    })).toEqual({
      authMode: "certificate",
      environment: "production",
      bundleId: "com.autovideogen.mobile",
      p12Path: "push.p12",
      p12Passphrase: "secret",
    });
  });
});

describe("buildLiveActivityPushPayload", () => {
  it("builds update payloads with content state and stale date", () => {
    const payload = buildLiveActivityPushPayload("update", {
      progress: 0.42,
      completed: false,
      failed: false,
    }) as { aps: Record<string, unknown> };
    expect(payload.aps.event).toBe("update");
    expect(payload.aps["content-state"]).toEqual({
      progress: 0.42,
      completed: false,
      failed: false,
    });
    expect(typeof payload.aps["stale-date"]).toBe("number");
  });

  it("builds terminal alerts on end", () => {
    const payload = buildLiveActivityPushPayload("end", {
      progress: 1,
      completed: true,
      failed: false,
    }, "My video", "en") as { aps: Record<string, any> };
    expect(payload.aps.event).toBe("end");
    expect(payload.aps.alert.title).toBe("Video ready");
    expect(payload.aps.alert.body).toContain("My video");
    expect(payload.aps.alert.sound).toBe("default");
    expect(typeof payload.aps["dismissal-date"]).toBe("number");
  });

  it("localizes terminal alerts to the registered app locale", () => {
    const payload = buildLiveActivityPushPayload("end", {
      progress: 1,
      completed: true,
      failed: false,
    }, "Bản tin sáng", "vi") as { aps: Record<string, any> };
    expect(payload.aps.alert.title).toBe("Video đã sẵn sàng");
    expect(payload.aps.alert.body).toBe("Bản tin sáng đã render xong và sẵn sàng để xem.");
  });
});
