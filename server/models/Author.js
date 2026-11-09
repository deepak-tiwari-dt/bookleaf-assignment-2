import mongoose from 'mongoose';

const authorSchema = new mongoose.Schema({
  authorId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  city: { type: String, default: '', index: true },
  country: { type: String, default: 'India' },
  joinedDate: { type: Date, default: null },
  verified: { type: Boolean, default: true }
}, { timestamps: true });

authorSchema.index({ name: 'text', email: 'text' });
export default mongoose.model('Author', authorSchema);
