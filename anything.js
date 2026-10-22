const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Root path for file operations
const ROOT_PATH = "C:/Users/sivam/AppData/Roaming/anythingllm-desktop/MythThriller";

// Ensure safe path resolution
function safePath(fileName) {
  return path.join(ROOT_PATH, path.basename(fileName));
}

// Create file
app.post('/file/create', (req, res) => {
  const { fileName, content } = req.body;
  const fullPath = safePath(fileName);
  fs.writeFile(fullPath, content || '', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, path: fullPath });
  });
});

// Edit file (overwrite)
app.post('/file/edit', (req, res) => {
  const { fileName, content } = req.body;
  const fullPath = safePath(fileName);
  fs.writeFile(fullPath, content, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, path: fullPath });
  });
});

// Delete file
app.post('/file/delete', (req, res) => {
  const { fileName } = req.body;
  const fullPath = safePath(fileName);
  fs.unlink(fullPath, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, path: fullPath });
  });
});

app.listen(3001, () => {
  console.log('File System MCP server running on http://localhost:3001');
});
