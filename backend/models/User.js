// models/User.js
import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  originalName: { type: String },
  filename: { type: String },
  path: { type: String }, // web path like /uploads/<userId>/<filename>
  size: { type: Number },
  uploadedAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    documents: { type: [DocumentSchema], default: [] }
  },
  { timestamps: true }
);

const User = mongoose.model('User', UserSchema);
export default User;
