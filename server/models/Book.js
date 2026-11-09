import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  bookId: { type: String, required: true, unique: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true, index: true },
  authorId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  isbn: { type: String, default: '' },
  genre: { type: String, default: '' },
  status: { type: String, default: 'Published & Live' },
  publishedAt: { type: Date, default: null },
  mrp: { type: Number, default: null },
  royaltyPerCopy: { type: Number, default: null },
  platforms: { type: [String], default: [] },
  printPartner: { type: String, default: null },
  copiesSold: { type: Number, default: 0 },
  earned: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  pending: { type: Number, default: 0 },
  lastPayout: { type: Date, default: null }
}, { timestamps: true });

bookSchema.index({ author: 1, status: 1 });
export default mongoose.model('Book', bookSchema);
