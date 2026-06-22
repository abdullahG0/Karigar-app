import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
router.use(authenticate);

// ── GET /api/messages/:booking_id ──────────────────────────────────────────────
router.get('/:booking_id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: userId, role } = req.user!;

    const { rows: bRows } = await db.query(
      'SELECT resident_id, professional_id FROM bookings WHERE id = $1',
      [req.params.booking_id]
    );
    const booking = bRows[0] as { resident_id: string; professional_id: string | null } | undefined;

    if (!booking) { fail(res, 'Booking not found', 404); return; }

    const isParty = booking.resident_id === userId || booking.professional_id === userId;
    if (!isParty && role !== 'admin') {
      fail(res, 'Access denied', 403); return;
    }

    const { rows } = await db.query(`
      SELECT m.*, u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.booking_id = $1
      ORDER BY m.created_at ASC
    `, [req.params.booking_id]);

    ok(res, rows);
  } catch (err) {
    console.error('[GET /messages/:booking_id]', err);
    fail(res, 'Could not fetch messages', 500);
  }
});

// ── POST /api/messages ─────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, content } = req.body as {
      booking_id?: string;
      content?: string;
    };

    if (!booking_id || !content) {
      fail(res, 'booking_id and content are required');
      return;
    }
    if (content.trim().length === 0) {
      fail(res, 'content must not be empty');
      return;
    }
    if (content.trim().length > 2000) {
      fail(res, 'Message must be 2000 characters or fewer'); return;
    }

    const { rows: bRows } = await db.query(
      'SELECT resident_id, professional_id FROM bookings WHERE id = $1',
      [booking_id]
    );
    const booking = bRows[0] as { resident_id: string; professional_id: string | null } | undefined;

    if (!booking) { fail(res, 'Booking not found', 404); return; }

    const isParty = booking.resident_id === req.user!.id || booking.professional_id === req.user!.id;
    if (!isParty && req.user!.role !== 'admin') {
      fail(res, 'Access denied', 403); return;
    }

    const id = uuidv4();
    await db.query(
      'INSERT INTO messages (id, booking_id, sender_id, content) VALUES ($1,$2,$3,$4)',
      [id, booking_id, req.user!.id, content.trim()]
    );

    const { rows } = await db.query(`
      SELECT m.*, u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = $1
    `, [id]);

    ok(res, rows[0], 201);
  } catch (err) {
    console.error('[POST /messages]', err);
    fail(res, 'Could not send message', 500);
  }
});

export default router;
