import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
router.use(authenticate);

// ── GET /api/reviews/professional/:professionalUserId ──────────────────────────
router.get('/professional/:professionalUserId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const offset = Math.max(0, parseInt((req.query.offset as string) ?? '0', 10) || 0);

    const { rows } = await db.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             u.name AS reviewer_name
      FROM reviews r
      JOIN users u ON u.id = r.resident_id
      WHERE r.professional_id = $1
      ORDER BY r.created_at DESC
      LIMIT 10 OFFSET $2
    `, [req.params.professionalUserId, offset]);

    ok(res, rows);
  } catch (err) {
    console.error('[GET /reviews/professional/:id]', err);
    fail(res, 'Could not fetch reviews', 500);
  }
});

// ── POST /api/reviews  (resident only) ────────────────────────────────────────
router.post('/', requireRole('resident'), async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { rows: bRows } = await db.query(
      'SELECT id, status, resident_id, professional_id FROM bookings WHERE id = $1',
      [booking_id]
    );
    const booking = bRows[0] as
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

    const { rows: existing } = await db.query(
      'SELECT id FROM reviews WHERE booking_id = $1',
      [booking_id]
    );
    if (existing.length > 0) {
      fail(res, 'A review for this booking already exists', 409);
      return;
    }

    const id = uuidv4();
    await db.query(
      'INSERT INTO reviews (id, booking_id, resident_id, professional_id, rating, comment) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, booking_id, req.user!.id, booking.professional_id, ratingNum, comment ?? null]
    );

    // Recalculate professional's average rating.
    const { rows: avgRows } = await db.query(
      'SELECT AVG(rating::numeric) AS avg_rating FROM reviews WHERE professional_id = $1',
      [booking.professional_id]
    );
    const avg_rating = parseFloat(avgRows[0].avg_rating) || 0;
    await db.query('UPDATE professionals SET rating = $1 WHERE user_id = $2', [
      Math.round(avg_rating * 10) / 10,
      booking.professional_id,
    ]);

    const { rows: revRows } = await db.query('SELECT * FROM reviews WHERE id = $1', [id]);
    ok(res, revRows[0], 201);
  } catch (err) {
    console.error('[POST /reviews]', err);
    fail(res, 'Could not submit review', 500);
  }
});

export default router;
