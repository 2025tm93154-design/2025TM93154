# LLM Story Generator

A full-stack story generator scaffold with a React/Vite frontend and Node/Express backend.

Features:
- Prompt-based story generation UI
- AnythingLLM integration for multiple-model story synthesis, including `llama-3`, `mistral`, and `qwen2.5:7b`
- Ollama character route with fictional character behavior and session memory
- Context-aware generation that keeps tone and narrative continuity
 - MCP-powered character generation: create characters classified as `protagonist`, `antagonist`, `deutrogenist`, or `supporting`.
 - Upload story drafts (`.pdf`, `.docx`, `.txt`) and let AnythingLLM read them as context for subsequent generations.

## Setup

1. Copy `.env.example` to `.env` in the `backend` folder and set `ANYTHINGLLM_API_KEY`, `ANYTHINGLLM_ENDPOINT`, `OLLAMA_BASE_URL`, and `OLLAMA_API_KEY` if needed.

2. Install all dependencies from the project root:

```bash
npm install
```

## Run

Start both backend and frontend together from the project root:

```bash
npm run dev
```

Open the browser at `http://localhost:5173` to use the story generator.

## New Features

- Dynamic Ollama model discovery: frontend queries `/api/ollama/models` and lists available models. Add/remove models in Ollama and refresh the UI to pick them.
- Persistent characters and stories: stored in a local SQLite DB at `backend/data/llm.db` using `better-sqlite3`.
- Character management endpoints: `POST /api/character/create`, `GET /api/character/list`, `GET /api/character/:id`, `DELETE /api/character/:id`.
- Upload drafts: `POST /api/upload/draft` (multipart `file`) — extracts text from `.pdf`, `.docx`, `.txt` and the frontend sends extracted text as `context` to model generation.
- Save/list/edit/delete/download stories: `POST /api/stories/save`, `GET /api/stories/list`, `GET /api/stories/:id`, `DELETE /api/stories/:id`, `GET /api/stories/:id/download` (returns a `.docx`).

## Notes

- For large-scale production storage, replace the local SQLite DB with a managed database (Postgres, MySQL, etc.).
- Ensure Ollama is running locally and models such as `qwen2.5:7b` are installed if you want to use them via Ollama.
```
