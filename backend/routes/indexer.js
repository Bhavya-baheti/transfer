// routes/indexer.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import Chunk from '../models/Chunk.js';
import { embedTexts } from '../services/azure.js';

const router = express.Router();

function splitIntoChunks(text, chunkChars = 1200, overlap = 200) {
  const chunks = [];
  if (!text) return chunks;
  const len = text.length;
  let start = 0;
  while (start < len) {
    const end = Math.min(start + chunkChars, len);
    const slice = text.slice(start, end);
    chunks.push(slice);
    if (end === len) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

// POST /api/indexer/index
// body: { filename }
router.post('/index', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ message: 'filename required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const doc = user.documents.find(d => d.filename === filename);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const absolutePath = path.join(process.cwd(), 'uploads', String(req.user.id), filename);
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ message: 'File not found on disk' });

    const extractorPath = path.join(process.cwd(), 'services', 'extract_pdf.py');
    // attempt multiple python commands for cross-platform compatibility
    const pythonCandidates = ['python', 'py', 'python3'];
    let py;
    let lastErr = '';
    for (const cmd of pythonCandidates) {
      try {
        py = spawn(cmd, [extractorPath, absolutePath]);
        break;
      } catch (e) {
        lastErr = String(e);
      }
    }
    if (!py) {
      return res.status(500).json({ message: 'Python not found. Please install Python and pdfplumber.', error: lastErr });
    }

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    py.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    py.on('error', (err) => {
      return res.status(500).json({ message: 'Failed to start Python process', error: String(err) });
    });

    py.on('close', async (code) => {
      if (code !== 0) {
        return res.status(500).json({ message: 'Extractor failed', error: stderr || stdout, code });
      }
      try {
        const parsed = JSON.parse(stdout || '{}');
        const text = parsed.text || '';
        const texts = splitIntoChunks(text);

        // create a batchId to preserve history of indexing runs
        const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        let docs = [];
        if (texts.length > 0) {
          // Batch embed (Azure supports array input)
          const embeddings = await embedTexts(texts);
          docs = texts.map((t, idx) => ({
            userId: user._id,
            documentId: doc._id,
            filename: filename,
            batchId,
            originalName: doc.originalName,
            path: doc.path,
            chunkIndex: idx,
            text: t,
            embedding: embeddings[idx],
            numTokensApprox: Math.ceil(t.length / 4)
          }));
          if (docs.length > 0) {
            await Chunk.insertMany(docs);
          }
        }

        return res.json({ message: 'Indexed', chunks: docs.length, batchId });
      } catch (e) {
        return res.status(500).json({ message: 'Failed to parse or save chunks', error: String(e) });
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;


