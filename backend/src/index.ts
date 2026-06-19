import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import http from 'http';

import { getDb } from './database/setup';
import { seedIfEmpty } from './database/seed';
import { initializeSocket } from './socket/index';

// Initialise the database and seed on first boot.
// getDb() is a no-op after first call (singleton), but placing it here documents intent clearly.
getDb();
seedIfEmpty();

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import categoriesRouter from './routes/categories';
import professionalsRouter from './routes/professionals';
import bookingsRouter from './routes/bookings';
import quotesRouter from './routes/quotes';
import messagesRouter from './routes/messages';
import reviewsRouter from './routes/reviews';
import adminRouter from './routes/admin';

const app = express();
const server = http.createServer(app);

// ── Socket.IO ──────────────────────────────────────────────────────────────────
initializeSocket(server);

// ── Global middleware ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));

// Rate limit auth endpoints — 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRouter);
app.use('/api/users',         usersRouter);
app.use('/api/categories',    categoriesRouter);
app.use('/api/professionals', professionalsRouter);
app.use('/api/bookings',      bookingsRouter);
app.use('/api/quotes',        quotesRouter);
app.use('/api/messages',      messagesRouter);
app.use('/api/reviews',       reviewsRouter);
app.use('/api/admin',         adminRouter);

app.get('/', (_req, res) => {
  res.json({
    status:    'ok',
    version:   '1.0.0',
    app:       'Karigar API',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandled]', err);
  res.status(500).json({ success: false, error: 'An unexpected server error occurred' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Parkview backend running on http://localhost:${PORT}`);
});
