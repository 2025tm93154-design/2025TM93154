import { useEffect, useState, useRef } from "react";
import { getOllamaModels, getOllamaStatus } from "../services/api";

function chooseBestModels(models) {
  const preferred = ["llama-3", "qwen2.5:7b", "mistral", "llama-2", "qwen2.5", "mistral-7b"];
  const selected = preferred.filter((model) => models.includes(model));
  return selected.length ? selected.slice(0, 3) : models.slice(0, Math.min(models.length, 3));
}

function PromptForm({
  prompt,
  setPrompt,
  storyGenre,
  setStoryGenre,
  characterName,
  setCharacterName,
  models,
  setModels,
  primaryModel,
  setPrimaryModel,
  onGenerateStory,
  onTalkToCharacter,
  loading
}) {
  const [availableModels, setAvailableModels] = useState([]); // [{id,name,description,size}]
  const [ollamaStatus, setOllamaStatus] = useState({ available: false, message: 'Checking Ollama...' });
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [pollIntervalSec, setPollIntervalSec] = useState(15);
  const pollRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const statusData = await getOllamaStatus().catch(() => ({ available: false, message: 'Ollama unavailable', models: [] }));
      if (!mounted) return;
      setOllamaStatus({ available: !!statusData.available, message: statusData.available ? 'Ollama available' : 'Ollama unavailable' });

      const modelList = statusData?.models?.length ? statusData.models : await getOllamaModels().catch(() => []);
      if (!mounted) return;

      const normalized = Array.isArray(modelList)
        ? modelList.map((m) => {
            if (typeof m === 'string') return { id: m, name: m, description: '', size: '' };
            const id = m.id || m.name || m.model || JSON.stringify(m);
            const name = m.name || m.id || m.model || id;
            const description = m.description || m.summary || m.meta || '';
            const size = m.size || m.parameters || (m.model_size && String(m.model_size)) || '';
            return { id, name, description, size };
          })
        : [];

      setAvailableModels(normalized);

      if (normalized.length && models.length === 0) {
        const best = chooseBestModels(normalized.map((x) => x.id));
        setModels(best);
        if (!primaryModel) setPrimaryModel(best[0] || normalized[0]?.id);
      }
      if (normalized.length && !primaryModel) {
        setPrimaryModel(normalized[0]?.id || '');
      }
    }

    refresh();

    if (pollingEnabled) {
      pollRef.current = setInterval(() => refresh(), Math.max(5, pollIntervalSec) * 1000);
    }

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [models.length, primaryModel, setModels, setPrimaryModel, pollingEnabled, pollIntervalSec]);

  const toggleModel = (model) => {
    setModels((current) =>
      current.includes(model) ? current.filter((item) => item !== model) : [...current, model]
    );
  };

  const handlePrimaryChange = (event) => {
    const nextPrimary = event.target.value;
    setPrimaryModel(nextPrimary);
    if (nextPrimary && !models.includes(nextPrimary)) {
      setModels((current) => [...current, nextPrimary]);
    }
  };

  return (
    <section className="prompt-panel">
      <label>
        Story prompt
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Write a short setup, e.g. 'A shadow warrior enters a forgotten castle...'"
          rows={5}
        />
      </label>

      <div className="status-row">
        <span className={`status-pill ${ollamaStatus.available ? 'available' : 'unavailable'}`}>
          Ollama: {ollamaStatus.message}
        </span>
      </div>

      <div className="control-row">
        <div className="model-selector">
          <strong>Primary Ollama model</strong>
          <select value={primaryModel} onChange={handlePrimaryChange}>
            <option value="">Auto select best model</option>
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <small>Choose a primary model or let the UI auto-select best available Ollama models.</small>

          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={pollingEnabled} onChange={(e) => setPollingEnabled(e.target.checked)} /> Auto-refresh models
            </label>
            <label style={{ display: 'block', marginTop: 8 }}>
              Poll interval (sec)
              <input type="number" min={5} value={pollIntervalSec} onChange={(e) => setPollIntervalSec(Number(e.target.value || 5))} style={{ width: 80, marginLeft: 8 }} />
            </label>
          </div>
        </div>

        <div className="model-selector">
          <strong>Parallel models</strong>
          {availableModels.length === 0 ? (
            <div className="empty-state">No models discovered. Using defaults.</div>
          ) : (
            availableModels.map((m) => (
              <label key={m.id} style={{ display: 'block', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={models.includes(m.id)} onChange={() => toggleModel(m.id)} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                    <div className="model-meta" style={{ fontSize: 12, color: '#9bb0c8' }}>{m.description || (m.size ? `Size: ${m.size}` : '')}</div>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div>
          <label>
            Story genre
            <input
              type="text"
              value={storyGenre}
              onChange={(event) => setStoryGenre(event.target.value)}
              placeholder="fantasy, sci-fi, thriller"
            />
          </label>
          <label>
            Character name
            <input
              type="text"
              value={characterName}
              onChange={(event) => setCharacterName(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="button-row">
        <button type="button" onClick={onGenerateStory} disabled={loading || !prompt}>
          Generate Story
        </button>
        <button type="button" onClick={onTalkToCharacter} disabled={loading || !prompt}>
          Continue as Character
        </button>
      </div>
    </section>
  );
}

export default PromptForm;
