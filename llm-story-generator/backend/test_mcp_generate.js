(async () => {
  const base = 'http://localhost:4000';
  try {
    console.log('Checking Ollama models...');
    let res = await fetch(`${base}/api/ollama/models`);
    let models = [];
    try {
      const json = await res.json();
      models = json.models || json;
    } catch (e) {
      const text = await res.text().catch(() => '');
      try { models = JSON.parse(text).models || JSON.parse(text); } catch (_) { models = []; }
    }
    if (!Array.isArray(models) || models.length === 0) {
      console.log('No models discovered; defaulting to ["llama-3"]');
      models = ['llama-3'];
    }
    models = models.map((m) => (typeof m === 'string' ? m : (m.id || m.name || m.model || JSON.stringify(m))));
    console.log('Discovered models:', models);

    const prompt = 'A fantasy thriller story.';
    console.log('Requesting MCP multi-model generation...');
    res = await fetch(`${base}/api/story/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, models, genre: 'fantasy', useMcp: true })
    });

    console.log('Generation status:', res.status, res.statusText);
    let data = null;
    try { data = await res.json(); } catch (e) { data = await res.text(); }
    console.log('Generation response:\n', typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error during test:', err.message || err);
  }
})();