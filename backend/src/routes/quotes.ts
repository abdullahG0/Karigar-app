import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';
import { getIo } from '../socket';

const router = Router();
router.use(authenticate);

// ── GET /api/quotes/booking/:bookingId ─────────────────────────────────────────
// Resident who owns the booking, or any professional who submitted a quote.
router.get('/booking/:bookingId', (req: AuthRequest, res: Response): void => {
  try {
    const { id: userId, role } = req.user!;
    const { bookingId } = req.params;

    const booking = db
      .prepare('SELECT id, resident_id FROM bookings WHERE id = ?')
      .get(bookingId) as { id: string; resident_id: string } | undefined;

    if (!booking) {
      fail(res, 'Booking not found', 404);
      return;
    }

    const isOwner = role === 'resident' && booking.resident_id === userId;
    const hasQuoted = role === 'professional' && !!db
      .prepare('SELECT id FROM quotes WHERE booking_id = ? AND professional_id = ?')
      .get(bookingId, userId);

    if (!isOwner && !hasQuoted && role !== 'admin') {
      fail(res, 'Access denied', 403);
      return;
    }

    const rows = db.prepare(`
      SELECT q.*, u.name AS professional_name, p.rating AS professional_rating
      FROM quotes q
      JOIN users u ON u.id = q.professional_id
      LEFT JOIN professionals p ON p.user_id = q.professional_id
      WHERE q.booking_id = ?
      ORDER BY q.created_at ASC
    `).all(bookingId);

    ok(res, rows);
  } catch (err) {
    console.error('[GET /quotes/booking/:bookingId]', err);
    fail(res, 'Could not fetch quotes', 500);
  }
});

// ── POST /api/quotes  (professional only) ──────────────────────────────────────
router.post('/', requireRole('professional'), (req: AuthRequest, res: Response): void => {
  try {
    const { booking_id, amount, note } = req.body as {
      booking_id?: string;
      amount?: number;
      note?: string;
    };

    if (!booking_id || amount === undefined) {
      fail(res, 'booking_id and amount are required');
      return;
    }
    if (typeof amount !== 'number' || amount <= 0) {
      fail(res, 'amount must be a positive number');
      return;
    }

    const booking = db
      .prepare('SELECT id, status FROM bookings WHERE id = ?')
      .get(booking_id) as { id: string; status: string } | undefined;

    if (!booking) {
      fail(res, 'Booking not found', 404);
      return;
    }
    if (!['pending_quote', 'quoted'].includes(booking.status)) {
      fail(res, 'Booking is no longer accepting quotes');
      return;
    }

    // Prevent a professional from quoting the same booking twice.
    const existing = db
      .prepare('SELECT id FROM quotes WHERE booking_id = ? AND professional_id = ?')
      .get(booking_id, req.user!.id);
    if (existing) {
      fail(res, 'You have already submitted a quote for this booking', 409);
      return;
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO quotes (id, booking_id, professional_id, amount, note) VALUES (?, ?, ?, ?, ?)'
    ).run(id, booking_id, req.user!.id, amount, note ?? null);

    // Mark booking as having at least one quote so the resident sees the quote badge.
    db.prepare("UPDATE bookings SET status = 'quoted' WHERE id = ? AND status = 'pending_quote'").run(booking_id);

    const quote = db.prepare(`
      SELECT q.*, u.name AS professional_name, p.rating AS professional_rating
      FROM quotes q
      JOIN users u ON u.id = q.professional_id
      LEFT JOIN professionals p ON p.user_id = q.professional_id
      WHERE q.id = ?
    `).get(id);

    getIo()?.to(`booking_${booking_id}`).emit('new_quote', quote);

    ok(res, quote, 201);
  } catch (err) {
    console.error('[POST /quotes]', err);
    fail(res, 'Could not submit quote', 500);
  }
});

// ── PATCH /api/quotes/:id/accept  (resident only) ─────────────────────────────
router.patch('/:id/accept', requireRole('resident'), (req: AuthRequest, res: Response): void => {
  try {
    const quote = db
      .prepare('SELECT * FROM quotes WHERE id = ?')
      .get(req.params.id) as
      | { id: string; booking_id: string; professional_id: string; amount: number; status: string }
      | undefined;

    if (!quote) {
      fail(res, 'Quote not found', 404);
      return;
    }
    if (quote.status !== 'pending') {
      fail(res, 'Quote has already been accepted or rejected', 400);
      return;
    }

    const booking = db
      .prepare('SELECT id, resident_id, status FROM bookings WHERE id = ?')
      .get(quote.booking_id) as { id: string; resident_id: string; status: string } | undefined;

    if (!booking) {
      fail(res, 'Booking not found', 404);
      return;
    }
    if (booking.resident_id !== req.user!.id) {
      fail(res, 'You can only accept quotes for your own bookings', 403);
      return;
    }
    if (!['pending_quote', 'quoted'].includes(booking.status)) {
      fail(res, 'Booking is not in a state that allows accepting a quote', 400);
      return;
    }

    // Accept this quote, reject all others on the same booking.
    db.prepare("UPDATE quotes SET status = 'accepted' WHERE id = ?").run(quote.id);
    db.prepare("UPDATE quotes SET status = 'rejected' WHERE booking_id = ? AND id != ?")
      .run(quote.booking_id, quote.id);

    // Confirm the booking and assign the professional.
    db.prepare(`
      UPDATE bookings
      SET status = 'confirmed', professional_id = ?, quote_amount = ?
      WHERE id = ?
    `).run(quote.professional_id, quote.amount, quote.booking_id);

    const updatedBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(quote.booking_id);
    getIo()?.to(`booking_${quote.booking_id}`).emit('quote_accepted', updatedBooking);

    ok(res, updatedBooking);
  } catch (err) {
    console.error('[PATCH /quotes/:id/accept]', err);
    fail(res, 'Could not accept quote', 500);
  }
});

export default router;
