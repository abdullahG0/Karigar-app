import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';
import { getIo } from '../socket';

const router = Router();
router.use(authenticate);

// ── GET /api/quotes/booking/:bookingId ─────────────────────────────────────────
router.get('/booking/:bookingId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: userId, role } = req.user!;
    const { bookingId } = req.params;

    const { rows: bRows } = await db.query(
      'SELECT id, resident_id FROM bookings WHERE id = $1',
      [bookingId]
    );
    const booking = bRows[0] as { id: string; resident_id: string } | undefined;

    if (!booking) {
      fail(res, 'Booking not found', 404);
      return;
    }

    const isOwner = role === 'resident' && booking.resident_id === userId;
    let hasQuoted = false;
    if (role === 'professional') {
      const { rows: qRows } = await db.query(
        'SELECT id FROM quotes WHERE booking_id = $1 AND professional_id = $2',
        [bookingId, userId]
      );
      hasQuoted = qRows.length > 0;
    }

    if (!isOwner && !hasQuoted && role !== 'admin') {
      fail(res, 'Access denied', 403);
      return;
    }

    const { rows } = await db.query(`
      SELECT q.*, u.name AS professional_name, p.rating AS professional_rating
      FROM quotes q
      JOIN users u ON u.id = q.professional_id
      LEFT JOIN professionals p ON p.user_id = q.professional_id
      WHERE q.booking_id = $1
      ORDER BY q.created_at ASC
    `, [bookingId]);

    ok(res, rows);
  } catch (err) {
    console.error('[GET /quotes/booking/:bookingId]', err);
    fail(res, 'Could not fetch quotes', 500);
  }
});

// ── POST /api/quotes  (professional only) ──────────────────────────────────────
router.post('/', requireRole('professional'), async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { rows: bRows } = await db.query(
      'SELECT id, status FROM bookings WHERE id = $1',
      [booking_id]
    );
    const booking = bRows[0] as { id: string; status: string } | undefined;

    if (!booking) {
      fail(res, 'Booking not found', 404);
      return;
    }
    if (!['pending_quote', 'quoted'].includes(booking.status)) {
      fail(res, 'Booking is no longer accepting quotes');
      return;
    }

    const { rows: existRows } = await db.query(
      'SELECT id FROM quotes WHERE booking_id = $1 AND professional_id = $2',
      [booking_id, req.user!.id]
    );
    if (existRows.length > 0) {
      fail(res, 'You have already submitted a quote for this booking', 409);
      return;
    }

    const id = uuidv4();
    await db.query(
      'INSERT INTO quotes (id, booking_id, professional_id, amount, note) VALUES ($1,$2,$3,$4,$5)',
      [id, booking_id, req.user!.id, amount, note ?? null]
    );

    await db.query(
      "UPDATE bookings SET status = 'quoted' WHERE id = $1 AND status = 'pending_quote'",
      [booking_id]
    );

    const { rows: qRows } = await db.query(`
      SELECT q.*, u.name AS professional_name, p.rating AS professional_rating
      FROM quotes q
      JOIN users u ON u.id = q.professional_id
      LEFT JOIN professionals p ON p.user_id = q.professional_id
      WHERE q.id = $1
    `, [id]);
    const quote = qRows[0];

    getIo()?.to(`booking_${booking_id}`).emit('new_quote', quote);
    ok(res, quote, 201);
  } catch (err) {
    console.error('[POST /quotes]', err);
    fail(res, 'Could not submit quote', 500);
  }
});

// ── PATCH /api/quotes/:id/accept  (resident only) ─────────────────────────────
router.patch('/:id/accept', requireRole('resident'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: qRows } = await db.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    const quote = qRows[0] as
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

    const { rows: bRows } = await db.query(
      'SELECT id, resident_id, status FROM bookings WHERE id = $1',
      [quote.booking_id]
    );
    const booking = bRows[0] as { id: string; resident_id: string; status: string } | undefined;

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

    await db.query("UPDATE quotes SET status = 'accepted' WHERE id = $1", [quote.id]);
    await db.query(
      "UPDATE quotes SET status = 'rejected' WHERE booking_id = $1 AND id != $2",
      [quote.booking_id, quote.id]
    );

    await db.query(`
      UPDATE bookings
      SET status = 'confirmed', professional_id = $1, quote_amount = $2
      WHERE id = $3
    `, [quote.professional_id, quote.amount, quote.booking_id]);

    const { rows: updRows } = await db.query('SELECT * FROM bookings WHERE id = $1', [quote.booking_id]);
    const updatedBooking = updRows[0];
    getIo()?.to(`booking_${quote.booking_id}`).emit('quote_accepted', updatedBooking);

    ok(res, updatedBooking);
  } catch (err) {
    console.error('[PATCH /quotes/:id/accept]', err);
    fail(res, 'Could not accept quote', 500);
  }
});

export default router;
