// routes/chat.js
import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Chunk from '../models/Chunk.js';
import Chat from '../models/Chat.js';
import { embedTexts, chatCompletion } from '../services/azure.js';

const router = express.Router();

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i] || 0;
    const vb = b[i] || 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// POST /api/chat/query  { documentId, query, topN? }
router.post('/query', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId, query, topN = 8 } = req.body || {};
    if (!documentId || !query) return res.status(400).json({ message: 'documentId and query required' });

    const [queryEmbedding] = await embedTexts([query]);

    const chunks = await Chunk.find({ userId, documentId, embedding: { $exists: true } }, { text: 1, embedding: 1 }).lean();
    if (!chunks || chunks.length === 0) {
      return res.status(404).json({ message: 'No embedded chunks found for this document. Please re-index.' });
    }

    const scored = chunks.map(c => ({ _id: c._id, text: c.text, score: cosineSimilarity(queryEmbedding, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(topN, 20));

    const context = scored.map((c, i) => `Chunk ${i + 1} [score ${c.score.toFixed(3)}]:\n${(c.text || '').slice(0, 4000)}`).join('\n\n');
    const systemPrompt = 'You are a helpful assistant. Answer strictly using the provided chunks. If unsure, say you do not know. Use inline citations like [Chunk X].';
    const answer = await chatCompletion({
      systemPrompt,
      messages: [
        { role: 'user', content: `User query: ${query}\n\nContext:\n${context}` }
      ],
      temperature: 0.1,
      max_tokens: 800
    });

    const chunkIds = scored.map(s => s._id);
    const chat = await Chat.findOneAndUpdate(
      { userId, documentId },
      { $push: { messages: { $each: [ { role: 'user', content: query, chunkIds }, { role: 'assistant', content: answer, chunkIds } ] } } },
      { upsert: true, new: true }
    );

    return res.json({ answer, chunks: scored, history: chat?.messages || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: String(err) });
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.query || {};
    if (!documentId) return res.status(400).json({ message: 'documentId required' });
    const chat = await Chat.findOne({ userId, documentId }).lean();
    return res.json({ messages: chat?.messages || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.query || {};
    if (!documentId) return res.status(400).json({ message: 'documentId required' });
    await Chat.findOneAndDelete({ userId, documentId });
    return res.json({ message: 'History cleared' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;


