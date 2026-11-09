import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import api from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.disable('x-powered-by');
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', api);
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Unexpected server error' });
});

async function start() {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  process.env.JWT_SECRET ||= 'local-only-change-me-before-deploying';
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookleaf_royalties');
  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve(__dirname, '../client/dist');
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.listen(port, () => console.log(`BookLeaf MERN API ready at http://localhost:${port}`));
}

start().catch(error => { console.error('Could not start BookLeaf:', error.message); process.exit(1); });
