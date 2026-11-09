import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import Author from '../models/Author.js';
import Book from '../models/Book.js';
import User from '../models/User.js';
import NotificationLog from '../models/NotificationLog.js';
import { requireAuth, requireRole, signInToken } from '../middleware/auth.js';

const router = Router();
const money = n => Math.round((Number(n) || 0) * 100) / 100;
const isPublished = b => String(b.status).toLowerCase().startsWith('published');
const royaltyStatus = (b, now = new Date()) => {
  if (!isPublished(b)) return 'production';
  if (money(b.earned - b.paid) <= 0) return 'paid';
  const anchor = b.lastPayout || b.publishedAt;
  return anchor && (now - anchor) / 86400000 > 90 ? 'overdue' : 'pending';
};
const serializeBook = b => ({
  id: b.bookId, title: b.title, isbn: b.isbn, genre: b.genre, status: b.status,
  publishedAt: b.publishedAt, mrp: b.mrp, royaltyPerCopy: b.royaltyPerCopy,
  platforms: b.platforms, printPartner: b.printPartner, copiesSold: b.copiesSold,
  earned: b.earned, paid: b.paid, pending: money(b.earned - b.paid),
  lastPayout: b.lastPayout, royaltyStatus: royaltyStatus(b)
});
const serializeLog = l => ({
  id: l.requestId, authorId: l.authorId, authorName: l.authorName, createdAt: l.createdAt,
  status: l.status, summary: l.summary, error: l.error, source: l.source, finishedAt: l.finishedAt
});
async function authorRecord(author) {
  await failStaleNotifications(author._id);
  const books = await Book.find({ author: author._id }).sort({ bookId: 1 }).lean();
  const logs = await NotificationLog.find({ author: author._id }).sort({ createdAt: -1 }).limit(20).lean();
  const totals = {
    books: books.length,
    copiesSold: books.reduce((s, b) => s + b.copiesSold, 0),
    earned: money(books.reduce((s, b) => s + b.earned, 0)),
    paid: money(books.reduce((s, b) => s + b.paid, 0)),
    pending: money(books.reduce((s, b) => s + Math.max(0, b.earned - b.paid), 0))
  };
  const statuses = books.map(b => royaltyStatus(b));
  return {
    id: author.authorId, name: author.name, email: author.email, phone: author.phone,
    city: author.city, country: author.country, joinedDate: author.joinedDate,
    verified: author.verified, totalBooks: books.length, totals,
    royaltyStatus: statuses.includes('overdue') ? 'overdue' : statuses.includes('pending') ? 'pending' : 'paid',
    books: books.map(serializeBook), logs: logs.map(serializeLog)
  };
}
async function failStaleNotifications(authorId) {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  await NotificationLog.updateMany(
    { ...(authorId ? { author: authorId } : {}), status: 'queued', createdAt: { $lt: cutoff } },
    { $set: { status: 'failed', error: 'Workflow did not report a result within five minutes.', finishedAt: new Date() } }
  );
}
function emailSummary(author, books, totals) {
  const inr = n => `₹${money(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const lines = [`Hello ${author.name.split(' ')[0]},`, '', 'Here is your latest BookLeaf royalty overview.', '', 'Published titles:'];
  for (const b of books.filter(isPublished)) lines.push(`• ${b.title}: ${b.copiesSold.toLocaleString('en-IN')} copies sold · ${inr(b.earned)} earned · ${inr(b.paid)} paid · ${inr(b.earned - b.paid)} pending`);
  lines.push('', `Total earned: ${inr(totals.earned)}`, `Total paid: ${inr(totals.paid)}`, `Total pending: ${inr(totals.pending)}`);
  lines.push(totals.pending > 0 ? 'Pending royalties follow BookLeaf’s quarterly settlement cycle, with payment within 45 days after quarter close.' : 'All current royalties are paid. Thank you for publishing with BookLeaf.');
  const production = books.filter(b => !isPublished(b));
  if (production.length) lines.push('', `In production: ${production.map(b => `${b.title} (${b.status})`).join(', ')}.`);
  lines.push('', 'Warm regards,', 'The BookLeaf Operations Team');
  return lines.join('\n');
}
async function dispatchSummary(author, triggeredBy) {
  const now = new Date();
  const idempotencyKey = `${author.authorId}:${Math.floor(now.getTime() / (15 * 60 * 1000))}`;
  const duplicate = await NotificationLog.findOne({ idempotencyKey });
  if (duplicate) return { log: serializeLog(duplicate), deduplicated: true };
  const books = await Book.find({ author: author._id }).sort({ bookId: 1 }).lean();
  const totals = {
    books: books.length, copiesSold: books.reduce((s, b) => s + b.copiesSold, 0),
    earned: money(books.reduce((s, b) => s + b.earned, 0)),
    paid: money(books.reduce((s, b) => s + b.paid, 0)),
    pending: money(books.reduce((s, b) => s + Math.max(0, b.earned - b.paid), 0))
  };
  const requestId = crypto.randomUUID();
  let log;
  try {
    log = await NotificationLog.create({ requestId, idempotencyKey, author: author._id, authorId: author.authorId, authorName: author.name, status: process.env.N8N_WEBHOOK_URL ? 'queued' : 'success', summary: '', source: triggeredBy });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrent = await NotificationLog.findOne({ idempotencyKey });
    if (concurrent) return { log: serializeLog(concurrent), deduplicated: true };
    throw error;
  }
  if (!process.env.N8N_WEBHOOK_URL) {
    log.summary = emailSummary(author, books, totals);
    log.finishedAt = new Date();
    await log.save();
    return { log: serializeLog(log), mode: 'local-demo' };
  }
  try {
    const base = (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
    const response = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BookLeaf-Token': process.env.N8N_WEBHOOK_SECRET || '', 'Idempotency-Key': requestId },
      body: JSON.stringify({ logId: requestId, author: { id: author.authorId, name: author.name, email: author.email }, books: books.map(serializeBook), totals, callbackUrl: `${base}/api/n8n/callback`, callbackToken: process.env.N8N_CALLBACK_SECRET || '' }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`n8n returned HTTP ${response.status}`);
    return { log: serializeLog(log) };
  } catch (error) {
    log.status = 'failed'; log.error = error.message; log.finishedAt = new Date(); await log.save();
    const failure = new Error(`Could not reach n8n: ${error.message}`); failure.log = serializeLog(log); throw failure;
  }
}

router.get('/health', (_req, res) => res.json({ ok: true, stack: 'MERN', workflow: process.env.N8N_WEBHOOK_URL ? 'n8n-connected' : 'local-demo' }));
router.post('/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email }).populate('author');
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ error: 'Email or password not recognized' });
  res.cookie('bookleaf_session', signInToken(user), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 12 * 60 * 60 * 1000, path: '/' });
  return res.json({ user: { id: user.author?.authorId || 'ADMIN', name: user.name, email: user.email, role: user.role } });
});
router.post('/auth/logout', (_req, res) => { res.clearCookie('bookleaf_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }); res.json({ ok: true }); });
router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.sub).populate('author');
  if (!user) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  return res.json({ user: { id: user.author?.authorId || 'ADMIN', name: user.name, email: user.email, role: user.role } });
});
router.get('/authors', requireAuth, requireRole('admin'), async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter = {};
  if (q) filter.$or = [{ name: { $regex: safeQuery, $options: 'i' } }, { email: { $regex: safeQuery, $options: 'i' } }];
  if (req.query.city) filter.city = req.query.city;
  const authors = await Author.find(filter).sort({ name: 1 }).lean();
  const records = await Promise.all(authors.map(a => authorRecord(a)));
  const filtered = req.query.status ? records.filter(a => a.royaltyStatus === req.query.status) : records;
  const [bookTotals, allAuthors] = await Promise.all([Book.aggregate([{ $group: { _id: null, earned: { $sum: '$earned' }, pending: { $sum: '$pending' }, books: { $sum: 1 } } }]), Author.distinct('city')]);
  const allBooks = bookTotals[0] || { earned: 0, pending: 0, books: 0 };
  const overdue = records.filter(a => a.royaltyStatus === 'overdue').length;
  return res.json({ authors: filtered, cities: allAuthors.sort(), summary: { authors: await Author.countDocuments(), books: allBooks.books, earned: money(allBooks.earned), pending: money(allBooks.pending), overdue } });
});
router.get('/author/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'author' || !req.user.authorId) return res.status(403).json({ error: 'Author account required' });
  const author = await Author.findOne({ authorId: req.user.authorId });
  if (!author) return res.status(404).json({ error: 'Author not found' });
  return res.json({ author: await authorRecord(author) });
});
router.get('/authors/:authorId', requireAuth, requireRole('admin'), async (req, res) => {
  const author = await Author.findOne({ authorId: req.params.authorId });
  if (!author) return res.status(404).json({ error: 'Author not found' });
  return res.json({ author: await authorRecord(author) });
});
router.get('/logs', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') await failStaleNotifications();
  else if (req.user.authorId) {
    const author = await Author.findOne({ authorId: req.user.authorId }).select('_id');
    if (author) await failStaleNotifications(author._id);
  }
  const filter = req.user.role === 'admin' ? {} : { authorId: req.user.authorId };
  const logs = await NotificationLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return res.json({ logs: logs.map(serializeLog) });
});
router.get('/authors.csv', requireAuth, requireRole('admin'), async (_req, res) => {
  const authors = await Author.find().sort({ name: 1 }).lean();
  const rows = [['Author', 'Email', 'City', 'Books', 'Copies Sold', 'Earned (INR)', 'Paid (INR)', 'Pending (INR)', 'Status']];
  for (const a of authors) { const v = await authorRecord(a); rows.push([a.name, a.email, a.city, v.totalBooks, v.totals.copiesSold, v.totals.earned, v.totals.paid, v.totals.pending, v.royaltyStatus]); }
  const csv = rows.map(row => row.map(x => `"${String(x).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  res.type('text/csv').attachment('bookleaf-authors.csv').send(csv);
});
router.post('/notifications/trigger', requireAuth, async (req, res, next) => {
  try {
    let author;
    if (req.user.role === 'admin') author = await Author.findOne({ authorId: req.body.authorId });
    else author = req.user.authorId ? await Author.findOne({ authorId: req.user.authorId }) : null;
    if (!author) return res.status(404).json({ error: 'Author not found' });
    const result = await dispatchSummary(author, req.user.role === 'admin' ? 'admin' : 'author');
    return res.status(result.log.status === 'queued' ? 202 : 200).json(result);
  } catch (error) { if (error.log) return res.status(502).json({ error: error.message, log: error.log }); return next(error); }
});
router.post('/notifications/bulk', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const authors = await Author.find().sort({ name: 1 });
    const eligible = [];
    for (const author of authors) {
      const books = await Book.find({ author: author._id }).lean();
      const pending = books.reduce((sum, b) => sum + Math.max(0, b.earned - b.paid), 0);
      if (pending > 0) eligible.push(author);
    }
    const results = [];
    for (const author of eligible) {
      try { results.push(await dispatchSummary(author, 'admin-bulk')); }
      catch (error) { results.push({ error: error.message, log: error.log || null }); }
    }
    return res.json({ count: results.length, results });
  } catch (error) { return next(error); }
});
router.post('/n8n/callback', (req, res) => {
  const expected = process.env.N8N_CALLBACK_SECRET || '';
  const supplied = String(req.get('X-Callback-Token') || '');
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid callback token' });
  return NotificationLog.findOne({ requestId: req.body.logId }).then(async log => {
    if (!log) return res.status(404).json({ error: 'Notification log not found' });
    log.status = req.body.status === 'success' ? 'success' : 'failed';
    log.summary = String(req.body.summary || ''); log.error = String(req.body.error || ''); log.finishedAt = new Date(); await log.save();
    return res.json({ ok: true, log: serializeLog(log) });
  });
});

export default router;
