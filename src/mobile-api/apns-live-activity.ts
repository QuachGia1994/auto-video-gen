import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { connect, type ClientHttp2Session } from "node:http2";

export type LiveActivityContentState = {
  progress: number;
  completed: boolean;
  failed: boolean;
};

export type LiveActivityPushEvent = "update" | "end";
export type LiveActivityLocale = "vi" | "en" | "zh" | "ja" | "fr";
export const LIVE_ACTIVITY_LOCALES = new Set<LiveActivityLocale>(["vi", "en", "zh", "ja", "fr"]);

export interface LiveActivityPushPublisher {
  send(args: {
    token: string;
    event: LiveActivityPushEvent;
    state: LiveActivityContentState;
    title?: string;
    locale: LiveActivityLocale;
  }): Promise<void>;
  close(): void;
}

type BaseConfig = {
  bundleId: string;
  environment: "sandbox" | "production";
};

export type APNsLiveActivityConfig =
  | (BaseConfig & {
      authMode: "token";
      keyPath: string;
      keyId: string;
      teamId: string;
    })
  | (BaseConfig & {
      authMode: "certificate";
      p12Path: string;
      p12Passphrase?: string;
    });

const DEFAULT_BUNDLE_ID = "com.autovideogen.mobile";
const TOKEN_REFRESH_MS = 45 * 60 * 1_000;

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for APNs Live Activity pushes`);
  return value;
}

export function loadAPNsLiveActivityConfig(env: NodeJS.ProcessEnv = process.env): APNsLiveActivityConfig | undefined {
  const mode = env.APNS_AUTH_MODE?.trim().toLowerCase();
  const hasTokenHints = Boolean(env.APNS_KEY_PATH || env.APNS_KEY_ID || env.APNS_TEAM_ID);
  const hasCertificateHints = Boolean(env.APNS_P12_PATH || env.APNS_P12_PASSPHRASE);
  if (!mode && !hasTokenHints && !hasCertificateHints) return undefined;

  const authMode = mode || (hasTokenHints ? "token" : "certificate");
  if (authMode !== "token" && authMode !== "certificate") {
    throw new Error("APNS_AUTH_MODE must be token or certificate");
  }
  const environment = env.APNS_ENVIRONMENT?.trim().toLowerCase() || "production";
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("APNS_ENVIRONMENT must be sandbox or production");
  }
  const bundleId = env.APNS_BUNDLE_ID?.trim() || DEFAULT_BUNDLE_ID;

  if (authMode === "token") {
    return {
      authMode,
      environment,
      bundleId,
      keyPath: required(env, "APNS_KEY_PATH"),
      keyId: required(env, "APNS_KEY_ID"),
      teamId: required(env, "APNS_TEAM_ID"),
    };
  }

  return {
    authMode,
    environment,
    bundleId,
    p12Path: required(env, "APNS_P12_PATH"),
    p12Passphrase: env.APNS_P12_PASSPHRASE?.trim() || undefined,
  };
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function createProviderToken(config: Extract<APNsLiveActivityConfig, { authMode: "token" }>) {
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = base64Url(JSON.stringify({ iss: config.teamId, iat: Math.floor(Date.now() / 1_000) }));
  const signingInput = `${header}.${claims}`;
  const key = createPrivateKey(readFileSync(config.keyPath, "utf8"));
  const signature = sign(null, Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64Url(signature)}`;
}

const ALERT_COPY: Record<LiveActivityLocale, {
  readyTitle: string;
  readyBody: (title: string) => string;
  stoppedTitle: string;
  stoppedBody: (title: string) => string;
  fallbackTitle: string;
}> = {
  en: {
    readyTitle: "Video ready",
    readyBody: (title) => `${title} finished rendering and is ready to review.`,
    stoppedTitle: "Render stopped",
    stoppedBody: (title) => `${title} could not be completed.`,
    fallbackTitle: "Video",
  },
  vi: {
    readyTitle: "Video đã sẵn sàng",
    readyBody: (title) => `${title} đã render xong và sẵn sàng để xem.`,
    stoppedTitle: "Đã dừng render",
    stoppedBody: (title) => `${title} không thể hoàn tất.`,
    fallbackTitle: "Video",
  },
  zh: {
    readyTitle: "视频已就绪",
    readyBody: (title) => `${title} 已完成渲染，可以查看。`,
    stoppedTitle: "渲染已停止",
    stoppedBody: (title) => `${title} 无法完成。`,
    fallbackTitle: "视频",
  },
  ja: {
    readyTitle: "動画の準備ができました",
    readyBody: (title) => `${title} のレンダリングが完了し、確認できます。`,
    stoppedTitle: "レンダリングを停止しました",
    stoppedBody: (title) => `${title} を完了できませんでした。`,
    fallbackTitle: "動画",
  },
  fr: {
    readyTitle: "Vidéo prête",
    readyBody: (title) => `Le rendu de ${title} est terminé et prêt à être visionné.`,
    stoppedTitle: "Rendu interrompu",
    stoppedBody: (title) => `Le rendu de ${title} n’a pas pu être terminé.`,
    fallbackTitle: "Vidéo",
  },
};

export function buildLiveActivityPushPayload(
  event: LiveActivityPushEvent,
  state: LiveActivityContentState,
  title?: string,
  locale: LiveActivityLocale = "en",
) {
  const now = Math.floor(Date.now() / 1_000);
  const aps: Record<string, unknown> = {
    timestamp: now,
    event,
    "content-state": state,
  };
  if (event === "update") {
    aps["stale-date"] = now + 120;
  } else {
    aps["dismissal-date"] = now + 15 * 60;
    const copy = ALERT_COPY[locale];
    const displayTitle = title?.trim() || copy.fallbackTitle;
    aps.alert = {
      title: state.failed ? copy.stoppedTitle : copy.readyTitle,
      body: state.failed ? copy.stoppedBody(displayTitle) : copy.readyBody(displayTitle),
      sound: "default",
    };
  }
  return { aps };
}

export function createAPNsLiveActivityPublisher(config: APNsLiveActivityConfig): LiveActivityPushPublisher {
  const origin = config.environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
  const topic = `${config.bundleId}.push-type.liveactivity`;
  let session: ClientHttp2Session | undefined;
  let providerToken: { value: string; createdAt: number } | undefined;

  const authHeaders = () => {
    if (config.authMode === "certificate") return {};
    if (!providerToken || Date.now() - providerToken.createdAt >= TOKEN_REFRESH_MS) {
      providerToken = { value: createProviderToken(config), createdAt: Date.now() };
    }
    return { authorization: `bearer ${providerToken.value}` };
  };

  const getSession = () => {
    if (session && !session.closed && !session.destroyed) return session;
    const tls = config.authMode === "certificate"
      ? { pfx: readFileSync(config.p12Path), passphrase: config.p12Passphrase }
      : undefined;
    session = connect(origin, tls);
    const current = session;
    current.on("error", () => {
      if (session === current) session = undefined;
    });
    current.on("close", () => {
      if (session === current) session = undefined;
    });
    return current;
  };

  return {
    async send({ token, event, state, title, locale }) {
      const payload = JSON.stringify(buildLiveActivityPushPayload(event, state, title, locale));
      const client = getSession();
      await new Promise<void>((resolve, reject) => {
        let status = 0;
        let responseBody = "";
        const request = client.request({
          ":method": "POST",
          ":path": `/3/device/${token}`,
          "apns-topic": topic,
          "apns-push-type": "liveactivity",
          "apns-priority": "10",
          "apns-expiration": "0",
          ...authHeaders(),
        });
        request.setEncoding("utf8");
        request.on("response", (headers) => {
          status = Number(headers[":status"] ?? 0);
        });
        request.on("data", (chunk: string) => {
          responseBody += chunk;
        });
        request.on("error", reject);
        request.on("end", () => {
          if (status >= 200 && status < 300) {
            resolve();
            return;
          }
          let reason = responseBody;
          try {
            const parsed = JSON.parse(responseBody) as { reason?: string };
            reason = parsed.reason || responseBody;
          } catch {
            // APNs may close without a JSON error body.
          }
          reject(new Error(`APNs Live Activity push failed with HTTP ${status}${reason ? `: ${reason}` : ""}`));
        });
        request.end(payload);
      });
    },
    close() {
      session?.close();
      session = undefined;
    },
  };
}
