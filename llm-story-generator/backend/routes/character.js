import express from "express";
import { generateOllama } from "../services/llmService.js";
import { defineCharacter } from "../services/mcpService.js";
import { upsertCharacter, getCharacter, listCharacters, deleteCharacter } from "../db.js";

const router = express.Router();
const sessionMemory = new Map();
const characters = new Map();

router.post("/create", async (req, res) => {
  try {
    const { name, classification = "supporting", model = "qwen2.5:7b" } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const profile = await defineCharacter({ name, classification, model });
    const id = profile.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    profile.id = id;
    await upsertCharacter({ id, name, classification, model, profile });
    return res.json({ profile });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/list", (req, res) => {
  const chars = listCharacters();
  return res.json({ characters: chars });
});

router.get("/:id", (req, res) => {
  const id = req.params.id;
  const profile = getCharacter(id);
  if (!profile) return res.status(404).json({ error: "not found" });
  return res.json({ profile });
});

router.post("/talk", async (req, res) => {
  try {
    const { sessionId, characterId, characterName = "Fictional Character", prompt, tone = "dramatic" } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const id = sessionId || `session_${Date.now()}`;
    const memory = sessionMemory.get(id) || [];

    let systemMessage = `You are ${characterName}. Respond strictly as this fictional character, preserve tone and narrative voice, and continue the story using the previous context.`;
    if (characterId) {
      const profile = getCharacter(characterId);
      if (profile) {
        systemMessage = `You are ${profile.name}, a ${profile.classification} character. Use this profile: ${JSON.stringify(profile)}. Respond strictly as this fictional character and continue the story maintaining established tone.`;
      }
    }

    const messages = [
      { role: "system", content: systemMessage },
      ...memory,
      { role: "user", content: prompt }
    ];

    const modelToUse = `ollama/${process.env.OLLAMA_CHARACTER_MODEL || 'llama-3'}`;
    const output = await generateOllama({
      model: modelToUse,
      prompt,
      messages
    });

    const nextMemory = [...memory, { role: "user", content: prompt }, { role: "assistant", content: output }];
    sessionMemory.set(id, nextMemory);

    return res.json({ sessionId: id, output, memory: nextMemory });
  } catch (error) {
    console.error("Character generation error", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/reset", (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && sessionMemory.has(sessionId)) {
    sessionMemory.delete(sessionId);
    return res.json({ sessionId, reset: true });
  }
  return res.status(404).json({ error: "Session not found" });
});

router.delete('/:id', (req, res) => {
  const id = req.params.id;
  try {
    deleteCharacter(id);
    return res.json({ deleted: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
