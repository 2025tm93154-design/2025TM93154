(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/ollama/status');
    console.log('Status fetch status:', res.status);
    try { const j = await res.json(); console.log('Status JSON:', JSON.stringify(j, null, 2)); } catch (e) { console.log('Status text:', await res.text()); }

    const res2 = await fetch('http://localhost:4000/api/ollama/models');
    console.log('Models fetch status:', res2.status);
    try { const m = await res2.json(); console.log('Models JSON:', JSON.stringify(m, null, 2)); } catch (e) { console.log('Models text:', await res2.text()); }
  } catch (err) {
    console.error('Fetch failed:', err.stack || err);
  }
})();