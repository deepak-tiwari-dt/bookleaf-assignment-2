import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, unique: true, sparse: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true, index: true },
  authorId: { type: String, required: true, index: true },
  authorName: { type: String, required: true },
  status: { type: String, enum: ['queued', 'success', 'failed'], default: 'queued', index: true },
  summary: { type: String, default: '' },
  error: { type: String, default: '' },
  source: { type: String, default: 'admin' },
  finishedAt: { type: Date, default: null }
}, { timestamps: true });

notificationLogSchema.index({ author: 1, createdAt: -1 });
export default mongoose.model('NotificationLog', notificationLogSchema);
