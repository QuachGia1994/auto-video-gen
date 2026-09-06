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
const HOST = "127.0.0.1";

function readPort() {
  const raw = process.env.MOBILE_API_PORT;
  if (!raw) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("MOBILE_API_PORT must be an integer between 1 and 65535");
  }
  return port;
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
const server = createMobileApiServer(manager, generation);
const port = readPort();

server.listen(port, HOST, () => {
  log.info(`Mobile render API listening on http://${HOST}:${port}`);
  log.info(`Render jobs write to ${outputRoot}`);
  if (!generation) log.warn("Source generation disabled: set SCRIPT_LLM_BASE_URL, SCRIPT_LLM_MODEL, and SCRIPT_LLM_API_KEY to enable POST /v1/generate");
});