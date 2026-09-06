import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { log } from "../utils/logger.js";

const require = createRequire(import.meta.url);
const HYPERFRAMES_CLI = require.resolve("hyperframes/dist/cli.js");

export type HyperframesProgress = {
  percent: number;
  message: string;
};

export interface RenderArgs {
  compositionDir: string;  // path to composition directory
  outputPath: string;      // path for .mp4
  fps?: number;            // default 30
  quality?: "draft" | "standard" | "high"; // default "standard"
  onProgress?: (progress: HyperframesProgress) => void;
}

const ANSI_ESCAPE = /\x1B\[[0-?]*[ -/]*[@-~]/g;

export function parseHyperframesProgressLine(line: string): HyperframesProgress | null {
  const clean = line.replace(ANSI_ESCAPE, "").trim();
  const match = /(\d{1,3})%\s+(.+)$/.exec(clean);
  if (!match) return null;
  const percent = Number(match[1]);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return { percent, message: match[2]!.trim() };
}

export async function renderWithHyperframes(args: RenderArgs): Promise<void> {
  const { compositionDir, outputPath, fps = 30, quality = "standard", onProgress } = args;

  const spawnArgs = [
    HYPERFRAMES_CLI,
    "render",
    compositionDir,
    "--output",
    outputPath,
    "--fps",
    String(fps),
    "--quality",
    quality,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(process.execPath, spawnArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let pending = "";
    let lastPercent = -1;
    const consume = (chunk: Buffer) => {
      process.stdout.write(chunk);
      pending += chunk.toString("utf8");
      const lines = pending.split(/[\r\n]+/);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const progress = parseHyperframesProgressLine(line);
        if (!progress || progress.percent === lastPercent) continue;
        lastPercent = progress.percent;
        onProgress?.(progress);
      }
    };

    proc.stdout?.on("data", consume);
    proc.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));

    proc.on("close", (code) => {
      const finalProgress = parseHyperframesProgressLine(pending);
      if (finalProgress && finalProgress.percent !== lastPercent) onProgress?.(finalProgress);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`hyperframes render failed with exit code ${code}`));
      }
    });

    proc.on("error", reject);
  });

  log.info(`Rendered: ${outputPath}`);
}
