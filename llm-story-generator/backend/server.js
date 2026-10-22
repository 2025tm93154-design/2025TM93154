import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import storyRouter from "./routes/story.js";
import characterRouter from "./routes/character.js";
import uploadRouter from "./routes/upload.js";
import ollamaRouter, { startOllamaDaemon, waitForOllamaReady } from "./routes/ollama.js";
import storiesRouter from "./routes/stories.js";

dotenv.config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.use("/api/story", storyRouter);
app.use("/api/character", characterRouter);
app.use("/api/upload", uploadRouter);

// serve uploaded files
import path from "path";
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/ollama', ollamaRouter);
app.use('/api/stories', storiesRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT || 4000;

// Auto-start Ollama if enabled
(async () => {
  const autoStartEnabled = (process.env.OLLAMA_AUTO_START || 'false').toLowerCase() === 'true';
  if (autoStartEnabled) {
    console.log('Attempting to auto-start Ollama...');
    const result = startOllamaDaemon();
    if (result.started) {
      console.log('Ollama daemon start initiated, waiting for readiness...');
      const ready = await waitForOllamaReady(30000, 1000).catch(() => false);
      if (ready) {
        console.log('✓ Ollama is ready and available.');
      } else {
        console.log('⚠ Ollama did not become ready within timeout.');
      }
    } else {
      console.log(`⚠ Failed to start Ollama: ${result.reason}`);
    }
  }

  app.listen(port, () => {
    console.log(`Story generator backend running on http://localhost:${port}`);
  });
})();
