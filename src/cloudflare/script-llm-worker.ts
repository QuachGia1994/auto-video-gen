type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatCompletionRequest = {
  messages?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
  top_p?: unknown;
  stream?: unknown;
};

type WorkersAIResult = {
  response?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: unknown;
};

export type ScriptLLMWorkerEnv = {
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<WorkersAIResult | string>;
  };
  API_SECRET: string;
  MODEL?: string;
};

const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_BODY_BYTES = 512_000;

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function authorized(request: Request, secret: string) {
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) return null;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "system" && role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return null;
    messages.push({ role, content });
  }
  return messages;
}

function optionalNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

function extractContent(result: WorkersAIResult | string) {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (typeof result !== "object" || result === null) return null;
  if (typeof result.response === "string" && result.response.trim()) return result.response.trim();
  if (typeof result.response === "object" && result.response !== null) return JSON.stringify(result.response);
  const content = result.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

async function readBody(request: Request): Promise<ChatCompletionRequest | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as ChatCompletionRequest : null;
  } catch {
    return null;
  }
}

async function chatCompletion(request: Request, env: ScriptLLMWorkerEnv) {
  if (!authorized(request, env.API_SECRET)) return json(401, { error: { message: "Unauthorized", type: "authentication_error" } });
  const body = await readBody(request);
  if (!body || body.stream === true) return json(400, { error: { message: "Invalid chat completion request", type: "invalid_request_error" } });
  const messages = parseMessages(body.messages);
  if (!messages) return json(400, { error: { message: "messages must be a non-empty array of text chat messages", type: "invalid_request_error" } });

  const model = env.MODEL?.trim() || DEFAULT_MODEL;
  const input: Record<string, unknown> = {
    messages,
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: "json_object" },
  };
  const temperature = optionalNumber(body.temperature, 0, 2);
  const maxTokens = optionalNumber(body.max_tokens, 1, 8_192);
  const topP = optionalNumber(body.top_p, 0, 1);
  if (temperature !== undefined) input.temperature = temperature;
  input.max_completion_tokens = maxTokens ?? 4_096;
  if (topP !== undefined) input.top_p = topP;

  try {
    const result = await env.AI.run(model, input);
    const content = extractContent(result);
    if (!content) return json(502, { error: { message: "Workers AI returned no text response", type: "upstream_error" } });
    return json(200, {
      id: `chatcmpl_${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      ...(typeof result === "object" && result !== null && result.usage !== undefined ? { usage: result.usage } : {}),
    });
  } catch {
    return json(502, { error: { message: "Workers AI request failed", type: "upstream_error" } });
  }
}

const worker = {
  async fetch(request: Request, env: ScriptLLMWorkerEnv) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true, provider: "cloudflare-workers-ai" });
    }
    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      return chatCompletion(request, env);
    }
    return json(404, { error: { message: "Not found", type: "not_found" } });
  },
};

export default worker;
