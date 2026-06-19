import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
router.use(authenticate);

// ── GET /api/messages/:booking_id ──────────────────────────────────────────────
router.get('/:booking_id', (req: AuthRequest, res: Response): void => {
  try {
    const { id: userId, role } = req.user!;

    const booking = db.prepare(
      'SELECT resident_id, professional_id FROM bookings WHERE id = ?'
    ).get(req.params.booking_id) as { resident_id: string; professional_id: string | null } | undefined;

    if (!booking) { fail(res, 'Booking not found', 404); return; }

    const isParty = booking.resident_id === userId || booking.professional_id === userId;
    if (!isParty && role !== 'admin') {
      fail(res, 'Access denied', 403); return;
    }

    const rows = db.prepare(`
      SELECT m.*, u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.booking_id = ?
      ORDER BY m.created_at ASC
    `).all(req.params.booking_id);

    ok(res, rows);
  } catch (err) {
    console.error('[GET /messages/:booking_id]', err);
    fail(res, 'Could not fetch messages', 500);
  }
});

// ── POST /api/messages ─────────────────────────────────────────────────────────
router.post('/', (req: AuthRequest, res: Response): void => {
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

    const booking = db.prepare(
      'SELECT resident_id, professional_id FROM bookings WHERE id = ?'
    ).get(booking_id) as { resident_id: string; professional_id: string | null } | undefined;

    if (!booking) { fail(res, 'Booking not found', 404); return; }

    const isParty = booking.resident_id === req.user!.id || booking.professional_id === req.user!.id;
    if (!isParty && req.user!.role !== 'admin') {
      fail(res, 'Access denied', 403); return;
    }

    if (content.trim().length > 2000) {
      fail(res, 'Message must be 2000 characters or fewer'); return;
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO messages (id, booking_id, sender_id, content) VALUES (?, ?, ?, ?)'
    ).run(id, booking_id, req.user!.id, content.trim());

    const message = db.prepare(`
      SELECT m.*, u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `).get(id);

    ok(res, message, 201);
  } catch (err) {
    console.error('[POST /messages]', err);
    fail(res, 'Could not send message', 500);
  }
});

export default router;
