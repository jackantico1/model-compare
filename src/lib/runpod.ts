import type { ChatMessage, ModelKey, ModelReply } from "./types";

interface RunpodModelConfig {
  endpointId: string;
  model: string;
}

function getConfig(key: ModelKey): RunpodModelConfig {
  const prefix = key.toUpperCase(); // "QWEN" | "LLAMA"
  const endpointId = process.env[`RUNPOD_${prefix}_ENDPOINT_ID`];
  const model = process.env[`RUNPOD_${prefix}_MODEL`];

  if (!endpointId) {
    throw new Error(
      `Missing RUNPOD_${prefix}_ENDPOINT_ID env var. Set it to the RunPod serverless endpoint ID for ${key}.`
    );
  }
  if (!model) {
    throw new Error(
      `Missing RUNPOD_${prefix}_MODEL env var. Set it to the model name your ${key} vLLM worker was deployed with.`
    );
  }

  return { endpointId, model };
}

// RunPod's vLLM quick-deploy workers expose an OpenAI-compatible chat completions
// route at /openai/v1/chat/completions on the serverless endpoint. If your worker
// uses a custom handler instead, swap this out for a /runsync call matching its
// input/output schema.
async function callChatCompletions(
  endpointId: string,
  model: string,
  messages: ChatMessage[],
  apiKey: string
): Promise<string> {
  const url = `https://api.runpod.ai/v2/${endpointId}/openai/v1/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`RunPod request failed (${res.status}): ${text.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error(`Unexpected response shape from RunPod: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getModelReply(
  key: ModelKey,
  messages: ChatMessage[]
): Promise<ModelReply> {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    return { model: key, content: "", error: "Missing RUNPOD_API_KEY env var." };
  }

  try {
    const { endpointId, model } = getConfig(key);
    const content = await callChatCompletions(endpointId, model, messages, apiKey);
    return { model: key, content };
  } catch (err) {
    return {
      model: key,
      content: "",
      error: err instanceof Error ? err.message : "Unknown error calling RunPod.",
    };
  }
}
