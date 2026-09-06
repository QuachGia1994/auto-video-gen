import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ScriptSchema } from "../render/script-schema.js";
import { createOpenAICompatibleScriptGenerator, loadScriptGeneratorConfig } from "./script-generator.js";
import type { SourceDocument } from "./source-input.js";

async function fixtureScript() {
  return JSON.parse(await readFile(join(process.cwd(), "tests", "fixtures", "sample-script-no-image.json"), "utf8"));
}

const source: SourceDocument = {
  sourceKind: "Text",
  title: "Verified title",
  text: "Verified source body",
  source: { url: "", domain: "local", image: null },
};

function completion(content: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("loadScriptGeneratorConfig", () => {
  it("requires base URL, model, and API key", () => {
    expect(() => loadScriptGeneratorConfig({})).toThrow("SCRIPT_LLM_BASE_URL");
    expect(() => loadScriptGeneratorConfig({ SCRIPT_LLM_BASE_URL: "https://api.example.com/v1" })).toThrow("SCRIPT_LLM_MODEL");
    expect(() => loadScriptGeneratorConfig({ SCRIPT_LLM_BASE_URL: "https://api.example.com/v1", SCRIPT_LLM_MODEL: "model" })).toThrow("SCRIPT_LLM_API_KEY");
  });
});

describe("createOpenAICompatibleScriptGenerator", () => {
  it("calls chat completions, validates the script, and preserves authoritative source metadata", async () => {
    const requests: Array<{ url: string; authorization: string | null; body: any }> = [];
    const authoritativeSource: SourceDocument = {
      sourceKind: "URL",
      title: "Verified title",
      text: "Verified source body",
      source: { url: "https://example.com/story", domain: "example.com", image: "https://example.com/cover.jpg" },
    };
    const candidate = await fixtureScript();
    candidate.metadata.source = { url: "https://hallucinated.invalid", domain: "wrong", image: null };
    candidate.metadata.channel = "Wrong channel";
    candidate.voice = { provider: "wrong", voiceId: "wrong", speed: 1 };

    const generator = createOpenAICompatibleScriptGenerator({
      config: {
        baseUrl: "https://api.example.com/v1",
        model: "compat-model",
        apiKey: "secret-key",
        channelName: "CườngIT",
        ttsProvider: "edge-tts",
      },
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("authorization"),
          body: JSON.parse(String(init?.body)),
        });
        return completion(candidate);
      },
    });

    const script = await generator.generate(authoritativeSource);

    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("https://api.example.com/v1/chat/completions");
    expect(requests[0]!.authorization).toBe("Bearer secret-key");
    expect(requests[0]!.body.model).toBe("compat-model");
    expect(requests[0]!.body.temperature).toBe(0.1);
    expect(requests[0]!.body.max_tokens).toBe(8192);
    expect(requests[0]!.body.messages[0].content).toContain("JSON");
    expect(script.metadata.source).toEqual({ url: "https://example.com/story", domain: "example.com", image: null });
    expect(script.metadata.channel).toBe("CườngIT");
    expect(script.voice.provider).toBe("edge-tts");
    expect(script.voice.voiceId).toBe("${VOICE_ID}");
    expect(ScriptSchema.safeParse(script).success).toBe(true);
  });

  it("retries malformed or schema-invalid model output and includes validation feedback", async () => {
    const valid = await fixtureScript();
    const requestBodies: any[] = [];
    let call = 0;
    const generator = createOpenAICompatibleScriptGenerator({
      config: {
        baseUrl: "https://api.example.com/v1/",
        model: "compat-model",
        apiKey: "secret-key",
        channelName: "CườngIT",
        ttsProvider: "edge-tts",
      },
      fetchImpl: async (_input, init) => {
        requestBodies.push(JSON.parse(String(init?.body)));
        call += 1;
        if (call === 1) return completion({ version: "1.0", scenes: [] });
        return completion(valid);
      },
    });

    const script = await generator.generate(source);

    expect(script.scenes.length).toBeGreaterThanOrEqual(5);
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[1].messages.at(-1).content).toContain("validation");
  });

  it("fails after the bounded validation attempts", async () => {
    let calls = 0;
    const generator = createOpenAICompatibleScriptGenerator({
      config: {
        baseUrl: "https://api.example.com/v1",
        model: "compat-model",
        apiKey: "secret-key",
        channelName: "CườngIT",
        ttsProvider: "edge-tts",
      },
      fetchImpl: async () => {
        calls += 1;
        return completion("not-json");
      },
    });

    await expect(generator.generate(source)).rejects.toThrow("valid script JSON");
    expect(calls).toBe(3);
  });
});
