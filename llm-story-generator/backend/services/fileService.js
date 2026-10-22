import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

async function extractTextFromPdf(filePath) {
  const data = await fs.promises.readFile(filePath);
  const result = await pdfParse(data);
  return result.text || "";
}

async function extractText(filePath, mimetype = "") {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx") return extractTextFromDocx(filePath);
  if (ext === ".pdf") return extractTextFromPdf(filePath);
  // fallback
  return fs.promises.readFile(filePath, "utf8");
}

export { extractText, extractTextFromDocx, extractTextFromPdf };
