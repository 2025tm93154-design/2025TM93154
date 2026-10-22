const API_BASE = "";

async function request(path, data) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json?.message || json?.error || text;
    } catch (err) {
      // If response is not valid JSON, keep the raw text
    }
    throw new Error(message || "API request failed");
  }

  return response.json();
}

export function generateStory(payload) {
  return request("/api/story/generate", payload);
}

export function talkToCharacter(payload) {
  return request("/api/character/talk", payload);
}

export function createCharacter(payload) {
  return request("/api/character/create", payload);
}

export async function listCharacters() {
  const res = await fetch(`/api/character/list`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteCharacterApi(id) {
  const res = await fetch(`/api/character/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadDraft(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload/draft', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getOllamaModels() {
  const res = await fetch('/api/ollama/models');
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.models || [];
}

export async function getOllamaStatus() {
  const res = await fetch('/api/ollama/status');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveStory(payload) {
  const res = await request('/api/stories/save', payload);
  return res;
}

export async function listStories() {
  const res = await fetch('/api/stories/list');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStory(id) {
  const res = await fetch(`/api/stories/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteStoryApi(id) {
  const res = await fetch(`/api/stories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function downloadStory(id) {
  window.open(`/api/stories/${id}/download`, '_blank');
}
