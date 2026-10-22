import dotenv from "dotenv";

dotenv.config();

const ANYTHING_API_KEY = process.env.ANYTHINGLLM_API_KEY;
const ANYTHING_ENDPOINT = process.env.ANYTHINGLLM_ENDPOINT || "https://api.anythingllm.com/v1/generate";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

async function generateAnythingLLM({ model, prompt, context = [], temperature = 0.7, max_tokens = 700, stop = ["\n\n"] }) {
  const payload = {
    model,
    prompt,
    context,
    temperature,
    max_tokens,
    stop
  };

  const response = await fetch(ANYTHING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ANYTHING_API_KEY ? { Authorization: `Bearer ${ANYTHING_API_KEY}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AnythingLLM request failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.output || result.text || "";
}

async function generateOllama({ model, prompt, messages = [] }) {
  const body = {
    model,
    prompt,
    messages
  };

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(OLLAMA_API_KEY ? { Authorization: `Bearer ${OLLAMA_API_KEY}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result?.content || result?.text || "";
}

function isOllamaModel(model) {
  if (!model) return false;
  const name = model.toLowerCase();
  return name.startsWith("qwen") || name.startsWith("ollama/") || name.startsWith("llama") || name.startsWith("mistral") || name.startsWith("alpaca") || name.startsWith("vicuna");
}

async function generateModel({ model, prompt, context = [], messages = [], temperature = 0.7, max_tokens = 700, stop = ["\n\n"] }) {
  if (!model || isOllamaModel(model)) {
    return generateOllama({ model: model || "llama-3", prompt, messages });
  }

  return generateAnythingLLM({ model, prompt, context, temperature, max_tokens, stop });
}

export { generateAnythingLLM, generateOllama, generateModel };
