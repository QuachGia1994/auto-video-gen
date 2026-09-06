import { join } from "node:path";
import { config } from "dotenv";
import { loadConfig } from "../config.js";
import { runPipeline } from "../pipeline.js";
import { log } from "../utils/logger.js";
import { createRenderJobManager } from "./job-manager.js";
import { createOpenAICompatibleScriptGenerator, loadScriptGeneratorConfig } from "./script-generator.js";
import { createMobileApiServer } from "./server.js";
import { createSourceResolver } from "./source-input.js";

config({ path: ".env.local", override: true });

const DEFAULT_PORT = 4319;
const DEFAULT_HOST = "127.0.0.1";

function readPort() {
  const raw = process.env.MOBILE_API_PORT;
  if (!raw) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("MOBILE_API_PORT must be an integer between 1 and 65535");
  }
  return port;
}

function readHost() {
  return process.env.MOBILE_API_HOST?.trim() || DEFAULT_HOST;
}

function isLoopbackHost(host: string) {
  return host === "127.0.0.1" || host === "::1" || host.toLowerCase() === "localhost";
}

function readWriteToken(host: string) {
  const token = process.env.MOBILE_API_TOKEN?.trim();
  if (!isLoopbackHost(host) && !token) {
    throw new Error("MOBILE_API_TOKEN is required when MOBILE_API_HOST is not loopback");
  }
  return token || undefined;
}

function createGenerationDependencies() {
  const names = ["SCRIPT_LLM_BASE_URL", "SCRIPT_LLM_MODEL", "SCRIPT_LLM_API_KEY"] as const;
  if (!names.every((name) => process.env[name]?.trim())) return undefined;
  const llm = loadScriptGeneratorConfig();
  const pipeline = loadConfig();
  return {
    sourceResolver: createSourceResolver(),
    scriptGenerator: createOpenAICompatibleScriptGenerator({
      config: {
        ...llm,
        channelName: pipeline.tiktok.displayName,
        ttsProvider: pipeline.ttsProvider,
      },
    }),
  };
}

const outputRoot = join(process.cwd(), "output", "mobile-api");
const manager = createRenderJobManager({ outputRoot, runPipeline });
const generation = createGenerationDependencies();
const host = readHost();
const writeToken = readWriteToken(host);
const server = createMobileApiServer(manager, generation, { writeToken });
const port = readPort();

server.listen(port, host, () => {
  log.info(`Mobile render API listening on http://${host}:${port}`);
  log.info(`Render jobs write to ${outputRoot}`);
  if (!generation) log.warn("Source generation disabled: set SCRIPT_LLM_BASE_URL, SCRIPT_LLM_MODEL, and SCRIPT_LLM_API_KEY to enable POST /v1/generate");
});