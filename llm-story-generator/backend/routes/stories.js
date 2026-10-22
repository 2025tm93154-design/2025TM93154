import express from 'express';
import { saveStory, listStories, getStory, deleteStory } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const router = express.Router();

router.post('/save', (req, res) => {
  try {
    const { id = uuidv4(), title = 'Untitled', content = '', models = [], character_id, draft_text, genre = 'general' } = req.body;
    saveStory({ id, title, content, models, character_id, draft_text, genre });
    return res.json({ id });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.get('/list', (req, res) => {
  try { return res.json({ stories: listStories() }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.get('/:id', (req, res) => {
  try { const s = getStory(req.params.id); if (!s) return res.status(404).json({}); return res.json({ story: s }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try { deleteStory(req.params.id); return res.json({ deleted: true }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.get('/:id/download', (req, res) => {
  try {
    const s = getStory(req.params.id);
    if (!s) return res.status(404).end();
    const doc = new Document();
    doc.addSection({ children: [
      new Paragraph({ children: [ new TextRun({ text: s.title, bold: true, size: 32 }) ] }),
      new Paragraph({ children: [ new TextRun({ text: s.content }) ] })
    ]});
    Packer.toBuffer(doc).then((buffer) => {
      res.setHeader('Content-Disposition', `attachment; filename="${s.title.replace(/[^a-z0-9]+/gi,'_')}.docx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(buffer);
    }).catch(e=>{ throw e });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

export default router;
