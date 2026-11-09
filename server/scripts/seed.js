import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Author from '../models/Author.js';
import Book from '../models/Book.js';
import User from '../models/User.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'data/Bookleaf Sample Data.json');
const input = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const dateOrNull = v => v ? new Date(`${v}T00:00:00.000Z`) : null;

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookleaf_royalties');
const authorPassword = await bcrypt.hash(process.env.AUTHOR_DEMO_PASSWORD || 'author123', 10);
for (const raw of input.authors) {
  const author = await Author.findOneAndUpdate({ authorId: raw.author_id }, {
    $set: { authorId: raw.author_id, name: raw.name, email: raw.email, phone: raw.phone || '', city: raw.city || '', country: 'India', joinedDate: dateOrNull(raw.joined_date), verified: true }
  }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await User.findOneAndUpdate({ email: raw.email.toLowerCase() }, {
    $set: { email: raw.email.toLowerCase(), name: raw.name, passwordHash: authorPassword, role: 'author', author: author._id }
  }, { upsert: true, new: true, setDefaultsOnInsert: true });
  for (const rawBook of raw.books) {
    await Book.findOneAndUpdate({ bookId: rawBook.book_id }, {
      $set: {
        bookId: rawBook.book_id, author: author._id, authorId: raw.author_id,
        title: rawBook.title, isbn: rawBook.isbn || '', genre: rawBook.genre || '', status: rawBook.status || 'Unknown',
        publishedAt: dateOrNull(rawBook.publication_date), mrp: rawBook.mrp ?? null,
        royaltyPerCopy: rawBook.author_royalty_per_copy ?? null, platforms: rawBook.available_on || [],
        printPartner: rawBook.print_partner || null, copiesSold: rawBook.total_copies_sold || 0,
        earned: rawBook.total_royalty_earned || 0, paid: rawBook.royalty_paid || 0,
        pending: rawBook.royalty_pending || 0, lastPayout: dateOrNull(rawBook.last_royalty_payout_date)
      }
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
}
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@bookleaf.demo').toLowerCase();
const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
await User.findOneAndUpdate({ email: adminEmail }, { $set: { email: adminEmail, name: 'Sarah Jenkins', passwordHash: adminPassword, role: 'admin', author: null } }, { upsert: true, new: true, setDefaultsOnInsert: true });
console.log(`Seeded ${input.authors.length} authors and ${input.authors.reduce((n, a) => n + a.books.length, 0)} books. Demo login: ${adminEmail} / configured admin password.`);
await mongoose.disconnect();
