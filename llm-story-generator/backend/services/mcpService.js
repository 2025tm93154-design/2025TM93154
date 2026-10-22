import { generateModel } from "./llmService.js";
import { buildStoryMessages, buildStoryPrompt } from "./storyService.js";

function normalizeModelName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function chooseFastStoryModel(models = []) {
  const preferred = [process.env.MCP_FAST_MODEL, "llama-3", "qwen2.5:7b", "mistral", "llama-2", "alpaca"].filter(Boolean);
  const normalized = models.map((m) => normalizeModelName(m));
  for (const candidate of preferred) {
    const normCandidate = normalizeModelName(candidate);
    const found = models.find((m) => normalizeModelName(m).includes(normCandidate) || normCandidate.includes(normalizeModelName(m)));
    if (found) return found; // return the actual discovered model name (e.g., 'llama3:latest')
  }
  // if no preferred candidate matched, pick the first discovered model
  if (models.length) return models[0];
  return preferred[0] || "llama-3";
}

async function defineCharacter({ name, classification = "supporting", model = "qwen2.5:7b" }) {
  const prompt = `Create a detailed character profile for a ${classification} character named ${name}. Respond in JSON with keys: id (short slug), name, role, classification, short_bio, personality_traits (array), motivations (array), speaking_style, example_first_paragraph.`;

  const output = await generateModel({ model, prompt });

  try {
    const jsonStart = output.indexOf("{");
    const jsonText = jsonStart >= 0 ? output.slice(jsonStart) : output;
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (e) {
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      name,
      role: name,
      classification,
      short_bio: output.slice(0, 800),
      personality_traits: [],
      motivations: [],
      speaking_style: "",
      example_first_paragraph: output
    };
  }
}

async function generateStory({ prompt, genre = "general", draftText = "", previousStory = "", model, temperature = 0.75, max_tokens = 450 }) {
  const modelToUse = model || chooseFastStoryModel();
  const messages = buildStoryMessages({ prompt, genre, draftText, previousStory });
  const output = await generateModel({ model: modelToUse, prompt, messages, temperature, max_tokens });
  return output;
}

function parseMultiModelOutput(output, models) {
  const lines = output.split(/\r?\n/);
  const sections = {};
  let currentModel = null;
  let currentLines = [];

  const headingRegex = /^(?:---|===)\s*(?:MODEL:\s*)?(.*?)\s*(?:---|===)?$/i;

  for (const line of lines) {
    const match = line.trim().match(headingRegex);
    if (match && match[1]) {
      const label = match[1].trim();
      const normalized = models.find((model) => model.toLowerCase() === label.toLowerCase());
      if (normalized) {
        if (currentModel) {
          sections[currentModel] = currentLines.join("\n").trim();
        }
        currentModel = normalized;
        currentLines = [];
        continue;
      }
    }
    if (currentModel) {
      currentLines.push(line);
    }
  }

  if (currentModel) {
    sections[currentModel] = currentLines.join("\n").trim();
  }

  return models.map((model) => ({
    model,
    output: sections[model] || output.trim()
  }));
}

async function generateMultiModelStory({ prompt, genre = "general", draftText = "", previousStory = "", models = [], temperature = 0.75, max_tokens = 450 }) {
  const modelToUse = chooseFastStoryModel(models);
  const modelList = models.length ? models : [modelToUse];

  const systemMessage = `You are a fast story engine. Produce one complete ${genre} story output for each requested model name in a single response. Clearly label each section with the model name using a heading such as '--- MODEL: <model-name> ---'.`;
  const userMessage = `${modelList.length > 0 ? `Requested models: ${modelList.join(", ")}` : ""}\n\n${buildStoryPrompt({ prompt, genre, draftText, previousStory })}`;
  const messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage }
  ];
  // Map generic preferred model names to discovered Ollama model IDs when possible
  const mappedModel = (models || []).find((m) => normalizeModelName(m).includes(normalizeModelName(modelToUse)) || normalizeModelName(modelToUse).includes(normalizeModelName(m))) || modelToUse;
  console.log('[mcpService] generateMultiModelStory - modelToUse:', modelToUse, 'mappedModel:', mappedModel, 'modelList:', modelList);

  const output = await generateModel({ model: mappedModel, prompt: userMessage, messages, temperature, max_tokens });
  return parseMultiModelOutput(output, modelList);
}

export { defineCharacter, generateStory, generateMultiModelStory, chooseFastStoryModel };
