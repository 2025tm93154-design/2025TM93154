import express from "express";
import { generateModel } from "../services/llmService.js";
import { buildStoryMessages } from "../services/storyService.js";
import { generateMultiModelStory } from "../services/mcpService.js";
import { getStory } from "../db.js";

const router = express.Router();

router.post("/generate", async (req, res) => {
  try {
    let {
      prompt,
      models = ["llama-3", "mistral", "qwen2.5:7b"],
      genre = "general",
      draftText = "",
      storyId,
      previousContent = "",
      useMcp = true
    } = req.body;

    if (!Array.isArray(models) || models.length === 0) {
      models = ["llama-3", "mistral", "qwen2.5:7b"];
    }

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const savedStory = storyId ? getStory(storyId) : null;
    const draftSource = draftText || savedStory?.draft_text || "";
    const previousStoryText = previousContent || savedStory?.content || "";

    const outputs = await generateMultiModelStory({
      prompt,
      genre,
      draftText: draftSource,
      previousStory: previousStoryText,
      models,
      temperature: 0.75,
      max_tokens: 450
    });
    const successful = outputs.filter((item) => !item.error);
    const errors = outputs.filter((item) => item.error);

    return res.json({ prompt, genre, models, draftText: draftSource, outputs: successful, errors });
  } catch (error) {
    console.error("Story generation error", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
