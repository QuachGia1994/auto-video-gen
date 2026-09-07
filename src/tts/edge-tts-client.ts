import { EdgeTTS, createSRT } from "edge-tts-universal";
import { writeFile } from "node:fs/promises";
import type { TtsClient } from "./tts-client.js";

export interface EdgeTtsOpts {
  voice: string;         // e.g. "vi-VN-HoaiMyNeural" or "vi-VN-NamMinhNeural"
  rate?: string;         // e.g. "+0%", "+10%", "-5%"
  pitch?: string;        // e.g. "+0Hz"
  volume?: string;       // e.g. "+0%"
  retryDelaysMs?: number[]; // test seam; production uses the resilient defaults below
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Edge TTS client using Microsoft Edge online text-to-speech service (Free).
 * Powered by `edge-tts-universal`.
 *
 * Supports subtitle generation (SRT) via word boundary cues.
 */
export class EdgeTtsClient implements TtsClient {
  constructor(private cfg: EdgeTtsOpts) {}

  async generate(text: string, audioOutPath: string, srtOutPath?: string): Promise<void> {
    await this.synthesizeWithRetry(text, audioOutPath, srtOutPath);
  }

  private async synthesizeWithRetry(
    text: string,
    audioOutPath: string,
    srtOutPath?: string,
  ): Promise<void> {
    // Edge's free WebSocket service intermittently returns "No audio was received"
    // even for valid text/voices. Keep the same scene/voice and retry long enough
    // to ride out a short provider-side/IP throttle instead of failing the whole job.
    const delays = this.cfg.retryDelaysMs ?? [1500, 3000, 6000, 12000, 24000];
    let lastErr: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const tts = new EdgeTTS(text, this.cfg.voice, {
          rate: this.cfg.rate ?? "+0%",
          pitch: this.cfg.pitch ?? "+0Hz",
          volume: this.cfg.volume ?? "+0%",
        });

        const result = await tts.synthesize();
        const buffer = Buffer.from(await result.audio.arrayBuffer());
        if (buffer.length === 0) {
          throw new Error("Edge TTS returned empty audio buffer");
        }
        await writeFile(audioOutPath, buffer);

        if (srtOutPath && result.subtitle && result.subtitle.length > 0) {
          const srtContent = createSRT(result.subtitle);
          await writeFile(srtOutPath, srtContent, "utf8");
        }
        return;
      } catch (e) {
        lastErr = e;
        if (attempt === delays.length) {
          const detail = e instanceof Error ? e.message : String(e);
          throw new Error(`Edge TTS unavailable after ${attempt + 1} attempts: ${detail}`);
        }
        await sleep(delays[attempt]!);
      }
    }
    throw lastErr;
  }
}
