import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
router.use(authenticate);

// ── GET /api/reviews/professional/:professionalUserId ──────────────────────────
// Paginated — pass ?offset=10 for the next page (limit fixed at 10).
router.get('/professional/:professionalUserId', (req: AuthRequest, res: Response): void => {
  try {
    const offset = Math.max(0, parseInt((req.query.offset as string) ?? '0', 10) || 0);

    const rows = db.prepare(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             u.name AS reviewer_name
      FROM reviews r
      JOIN users u ON u.id = r.resident_id
      WHERE r.professional_id = ?
      ORDER BY r.created_at DESC
      LIMIT 10 OFFSET ?
    `).all(req.params.professionalUserId, offset);

    ok(res, rows);
  } catch (err) {
    console.error('[GET /reviews/professional/:id]', err);
    fail(res, 'Could not fetch reviews', 500);
  }
});

// ── POST /api/reviews  (resident only) ────────────────────────────────────────
router.post('/', requireRole('resident'), (req: AuthRequest, res: Response): void => {
  try {
    const { booking_id, rating, comment } = req.body as {
      booking_id?: string;
      rating?: number;
      comment?: string;
    };

    if (!booking_id || rating === undefined) {
      fail(res, 'booking_id and rating are required');
      return;
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      fail(res, 'rating must be an integer between 1 and 5');
      return;
    }

    const booking = db
      .prepare('SELECT id, status, resident_id, professional_id FROM bookings WHERE id = ?')
      .get(booking_id) as
      | { id: string; status: string; resident_id: string; professional_id: string | null }
      | undefined;

    if (!booking) {
      fail(res, 'Booking not found', 404);
      return;
    }
    if (booking.status !== 'completed') {
      fail(res, 'Reviews can only be submitted for completed bookings');
      return;
    }
    if (booking.resident_id !== req.user!.id) {
      fail(res, 'You can only review your own bookings', 403);
      return;
    }
    if (!booking.professional_id) {
      fail(res, 'No professional is assigned to this booking', 400);
      return;
    }

    // Explicit duplicate check before insert.
    const existing = db
      .prepare('SELECT id FROM reviews WHERE booking_id = ?')
      .get(booking_id);
    if (existing) {
      fail(res, 'A review for this booking already exists', 409);
      return;
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO reviews (id, booking_id, resident_id, professional_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, booking_id, req.user!.id, booking.professional_id, ratingNum, comment ?? null);

    // Recalculate the professional's average rating (one decimal place).
    const { avg_rating } = db.prepare(
      'SELECT AVG(CAST(rating AS REAL)) AS avg_rating FROM reviews WHERE professional_id = ?'
    ).get(booking.professional_id) as { avg_rating: number };

    db.prepare('UPDATE professionals SET rating = ? WHERE user_id = ?').run(
      Math.round(avg_rating * 10) / 10,
      booking.professional_id
    );

    ok(res, db.prepare('SELECT * FROM reviews WHERE id = ?').get(id), 201);
  } catch (err) {
    console.error('[POST /reviews]', err);
    fail(res, 'Could not submit review', 500);
  }
});

export default router;
