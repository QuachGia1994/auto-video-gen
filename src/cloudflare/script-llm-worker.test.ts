import { describe, expect, it } from "vitest";
import worker, { type ScriptLLMWorkerEnv } from "./script-llm-worker.js";

const makeEnv = (): ScriptLLMWorkerEnv => ({
  AI: { run: async () => ({ response: "generated JSON" }) },
  API_SECRET: "test-secret",
  MODEL: "@cf/zai-org/glm-4.7-flash",
});

function makeRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://worker.test${path}`, init);
}

describe("Cloudflare script LLM worker", () => {
  it("rejects missing bearer auth", async () => {
    const response = await worker.fetch(makeRequest("/v1/chat/completions", { method: "POST" }), makeEnv());
    expect(response.status).toBe(401);
  });

  it("wraps Workers AI output in OpenAI chat completion shape", async () => {
    const calls: Array<{ model: string; input: unknown }> = [];
    const env = makeEnv();
    env.AI.run = async (model: string, input: unknown) => {
      calls.push({ model, input });
      return {
        choices: [{ message: { role: "assistant", content: "{\"version\":\"1.0\"}" } }],
        usage: { prompt_tokens: 12, completion_tokens: 7 },
      };
    };
    const response = await worker.fetch(makeRequest("/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
      body: JSON.stringify({ model: "ignored", messages: [{ role: "user", content: "hello" }] }),
    }), env);
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe("@cf/zai-org/glm-4.7-flash");
    expect((calls[0]!.input as any).messages).toEqual([{ role: "user", content: "hello" }]);
    expect((calls[0]!.input as any).chat_template_kwargs).toEqual({ enable_thinking: false });
    expect((calls[0]!.input as any).response_format).toEqual({ type: "json_object" });
    expect((calls[0]!.input as any).max_completion_tokens).toBe(4096);
    expect(body.model).toBe("@cf/zai-org/glm-4.7-flash");
    expect(body.choices[0].message.content).toBe("{\"version\":\"1.0\"}");
    expect(body.usage).toEqual({ prompt_tokens: 12, completion_tokens: 7 });
  });

  it("serializes structured Workers AI response objects as JSON content", async () => {
    const env = makeEnv();
    env.AI.run = async () => ({ response: { version: "1.0", scenes: [] } });
    const response = await worker.fetch(makeRequest("/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "json please" }] }),
    }), env);
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(JSON.parse(body.choices[0].message.content)).toEqual({ version: "1.0", scenes: [] });
  });

  it("rejects invalid bodies before calling Workers AI", async () => {
    let calls = 0;
    const env = makeEnv();
    env.AI.run = async () => { calls += 1; return { response: "x" }; };
    const response = await worker.fetch(makeRequest("/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    }), env);

    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  });

  it("provides a health endpoint", async () => {
    const response = await worker.fetch(makeRequest("/health"), makeEnv());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, provider: "cloudflare-workers-ai" });
  });
});
