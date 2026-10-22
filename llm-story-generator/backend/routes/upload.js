import express from "express";
import multer from "multer";
import path from "path";
import { extractText } from "../services/fileService.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");
await (async () => {
  try { await import('fs').then(fs=>fs.promises.mkdir(uploadDir,{ recursive:true })); } catch(e){ }
})();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

router.post("/draft", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const filePath = req.file.path;
    const text = await extractText(filePath, req.file.mimetype);
    return res.json({ file: req.file.filename, text });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
