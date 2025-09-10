// models/Chunk.js
import mongoose from 'mongoose';

const ChunkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    filename: { type: String, index: true, required: true },
    batchId: { type: String, index: true },
    originalName: { type: String },
    path: { type: String },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], index: false, default: undefined },
    numTokensApprox: { type: Number },
    uploadedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

ChunkSchema.index({ userId: 1, documentId: 1, batchId: 1, chunkIndex: 1 }, { unique: true });

const Chunk = mongoose.model('Chunk', ChunkSchema);
export default Chunk;

 