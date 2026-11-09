import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'author'], required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', default: null }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
