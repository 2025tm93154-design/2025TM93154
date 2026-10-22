import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { spawn } from 'child_process';

const router = express.Router();
const base = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const autoStart = (process.env.OLLAMA_AUTO_START || 'false').toLowerCase() === 'true';

let ollamaStarting = false;
let ollamaProcess = null;

async function waitForOllamaReady(timeoutMs = 30000, intervalMs = 1000) {
  const start = Date.now();
  const endpoints = ['/api/models', '/models', '/api/version', '/version', '/api/status', '/status'];
  while (Date.now() - start < timeoutMs) {
    for (const ep of endpoints) {
      try {
        const resp = await globalThis.fetch(`${base}${ep}`);
        if (resp.ok) return true;
      } catch (e) {
        // ignore and try next
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function startOllamaDaemon() {
  if (ollamaStarting || ollamaProcess) return { started: false, reason: 'already-starting' };
  try {
    // Attempt to spawn the ollama CLI in serve mode.
    // This requires the `ollama` binary to be installed and on PATH.
    ollamaStarting = true;
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    ollamaProcess = child;
    console.log('Attempted to start ollama via CLI (detached).');
    return { started: true };
  } catch (err) {
    ollamaStarting = false;
    console.error('Failed to spawn ollama CLI:', err.message || err);
    return { started: false, reason: err.message || String(err) };
  }
}

async function fetchJson(endpoint) {
  const response = await globalThis.fetch(`${base}${endpoint}`);
  if (!response.ok) throw new Error(`Status ${response.status}`);
  return response.json();
}

async function tryEndpoints(endpoints) {
  for (const ep of endpoints) {
    try {
      console.log(`  Trying endpoint: ${base}${ep}`);
      const data = await fetchJson(ep);
      console.log(`    Response type: ${typeof data}, isArray: ${Array.isArray(data)}, has models: ${!!data?.models}`);
      if (Array.isArray(data)) {
        console.log(`    Returned array with ${data.length} items`);
        return data;
      }
      if (data?.models) {
        console.log(`    Found models property: ${data.models.length} models`);
        return data.models;
      }
      if (data?.model) {
        console.log(`    Found model property`);
        return [data.model];
      }
      console.log(`    Returning data as-is`);
      return data;
    } catch (e) {
      console.log(`    Error: ${e.message}`);
      continue;
    }
  }
  console.log('All endpoints failed');
  return [];
}

router.get('/models', async (req, res) => {
  try {
    const endpoints = ['/api/tags', '/api/models', '/models', '/list', '/api/list'];
    console.log('Testing Ollama endpoints from base:', base);
    const models = await tryEndpoints(endpoints);
    console.log('Models result:', models);
    return res.json({ models });
  } catch (e) {
    console.error('Models error:', e);
    return res.status(500).json({ error: e.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const statusEndpoints = ['/api/tags', '/api/models', '/models', '/api/version', '/version', '/api/status', '/status'];
    let available = false;
    let models = [];
    let info = null;
    let endpoint = '';

    for (const ep of statusEndpoints) {
      try {
        const response = await globalThis.fetch(`${base}${ep}`);
        if (!response.ok) continue;
        endpoint = ep;
        available = true;
        const data = await response.json();
        info = data;
        if (Array.isArray(data)) {
          models = data;
          break;
        }
        if (data?.models) {
          models = data.models;
          break;
        }
        if (data?.model) {
          models = [data.model];
          break;
        }
        break;
      } catch (error) {
        continue;
      }
    }

    // If not available and autoStart is enabled, attempt to start Ollama
    let autoStartAttempt = null;
    if (!available && autoStart) {
      autoStartAttempt = startOllamaDaemon();
      if (autoStartAttempt.started) {
        const ready = await waitForOllamaReady(30000, 1000);
        if (ready) {
          // re-run discovery quickly
          const retrEndpoints = ['/api/tags', '/api/models', '/models', '/api/version', '/version', '/api/status', '/status'];
          for (const ep of retrEndpoints) {
            try {
              const response = await globalThis.fetch(`${base}${ep}`);
              if (!response.ok) continue;
              endpoint = ep;
              available = true;
              const data = await response.json();
              info = data;
              if (Array.isArray(data)) {
                models = data;
                break;
              }
              if (data?.models) {
                models = data.models;
                break;
              }
              if (data?.model) {
                models = [data.model];
                break;
              }
              break;
            } catch (e) {
              continue;
            }
          }
        }
      }
    }

    return res.json({ available, models, info, endpoint, autoStartAttempt });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export { startOllamaDaemon, waitForOllamaReady };
export default router;
