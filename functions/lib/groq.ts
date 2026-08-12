// llm_call step provider: Groq's OpenAI-compatible chat completions API.
// GROQ_API_KEY is provided via env var (see nhost secrets / .env.example).
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

export type LlmCallResult = { content: string; model: string; raw: any };

export async function callGroq(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
}): Promise<LlmCallResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  const model = opts.model || DEFAULT_MODEL;
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    { role: "user", content: opts.prompt },
  ];

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.3 }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Groq API error (${res.status}): ${json?.error?.message || JSON.stringify(json)}`);
  }
  const content = json?.choices?.[0]?.message?.content ?? "";
  return { content, model, raw: json };
}
