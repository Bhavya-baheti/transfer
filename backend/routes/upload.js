// routes/upload.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// storage: create uploads/<userId>/ and put files there
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const userId = String(req.user.id);
      const uploadPath = path.join(process.cwd(), 'uploads', userId);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const filename = `${Date.now()}-${base}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
  fileFilter: (req, file, cb) => {
    // accept only pdf
    if (file.mimetype !== 'application/pdf') {
      return cb(null, false); // skip non-pdf
    }
    cb(null, true);
  }
});

// POST /api/upload  -> upload multiple PDF files
// authMiddleware runs BEFORE multer in the call order below so req.user is available to storage.destination
router.post('/', authMiddleware, upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded or only non-PDF files were sent' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    for (const f of req.files) {
      const webPath = `/uploads/${req.user.id}/${f.filename}`; // public url from express static
      user.documents.push({
        originalName: f.originalname,
        filename: f.filename,
        path: webPath,
        size: f.size,
        uploadedAt: new Date()
      });
    }
    await user.save();

    return res.json({ message: 'Files uploaded', documents: user.documents });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/upload -> list current user's uploaded documents
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, { documents: 1 });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ documents: user.documents });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
