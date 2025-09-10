// models/Chat.js
import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    chunkIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    meta: { type: Object, default: {} }
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const ChatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    messages: { type: [MessageSchema], default: [] }
  },
  { timestamps: true }
);

ChatSchema.index({ userId: 1, documentId: 1, updatedAt: -1 });

const Chat = mongoose.model('Chat', ChatSchema);
export default Chat;


