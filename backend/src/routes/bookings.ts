import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';
import { getIo } from '../socket';

const router = Router();
router.use(authenticate);

// ── GET /api/bookings ──────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: userId, role } = req.user!;
    let rows: unknown[];

    if (role === 'resident') {
      const result = await db.query(`
        SELECT b.*, sc.name AS category_name,
               up.name AS professional_name
        FROM bookings b
        JOIN service_categories sc ON sc.id = b.category_id
        LEFT JOIN users up ON up.id = b.professional_id
        WHERE b.resident_id = $1
        ORDER BY b.created_at DESC
      `, [userId]);
      rows = result.rows;
    } else if (role === 'professional') {
      const result = await db.query(`
        SELECT DISTINCT b.*, sc.name AS category_name,
               ur.name AS resident_name
        FROM bookings b
        JOIN service_categories sc ON sc.id = b.category_id
        JOIN users ur ON ur.id = b.resident_id
        WHERE b.professional_id = $1
           OR (b.status IN ('pending_quote','quoted') AND b.category_id IN (
                 SELECT pc.category_id
                 FROM professional_categories pc
                 JOIN professionals p ON p.id = pc.professional_id
                 WHERE p.user_id = $2
               ))
        ORDER BY b.created_at DESC
      `, [userId, userId]);
      rows = result.rows;
    } else {
      const result = await db.query(`
        SELECT b.*, sc.name AS category_name,
               ur.name AS resident_name,
               up.name AS professional_name
        FROM bookings b
        JOIN service_categories sc ON sc.id = b.category_id
        JOIN users ur ON ur.id = b.resident_id
        LEFT JOIN users up ON up.id = b.professional_id
        ORDER BY b.created_at DESC
      `);
      rows = result.rows;
    }

    ok(res, rows);
  } catch (err) {
    console.error('[GET /bookings]', err);
    fail(res, 'Could not fetch bookings', 500);
  }
});

// ── POST /api/bookings  (resident only) ────────────────────────────────────────
router.post('/', requireRole('resident'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category_id, scheduled_at, address, problem_description } = req.body as {
      category_id?: string;
      scheduled_at?: string;
      address?: string;
      problem_description?: string;
    };

    if (!category_id || !scheduled_at || !address || !problem_description) {
      fail(res, 'category_id, scheduled_at, address, and problem_description are required');
      return;
    }
    if (address.trim().length > 300)              { fail(res, 'address must be 300 characters or fewer'); return; }
    if (problem_description.trim().length > 1000) { fail(res, 'problem_description must be 1000 characters or fewer'); return; }
    const parsedDate = new Date(scheduled_at);
    if (isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
      fail(res, 'scheduled_at must be a valid future date'); return;
    }

    const { rows: catRows } = await db.query(
      'SELECT id FROM service_categories WHERE id = $1 AND is_active = true',
      [category_id]
    );
    if (catRows.length === 0) {
      fail(res, `Service category '${category_id}' not found`);
      return;
    }

    const id = uuidv4();
    await db.query(`
      INSERT INTO bookings (id, resident_id, category_id, scheduled_at, address, problem_description)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [id, req.user!.id, category_id, scheduled_at, address, problem_description]);

    const { rows } = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = rows[0];

    getIo()?.to(`category_${category_id}`).emit('new_booking_request', booking);
    ok(res, booking, 201);
  } catch (err) {
    console.error('[POST /bookings]', err);
    fail(res, 'Could not create booking', 500);
  }
});

// ── GET /api/bookings/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: bookingRows } = await db.query(`
      SELECT b.*,
             sc.name  AS category_name,
             ur.name  AS resident_name,  ur.phone AS resident_phone,
             up.name  AS professional_name, up.phone AS professional_phone,
             p.rating AS professional_rating
      FROM bookings b
      JOIN  service_categories sc ON sc.id    = b.category_id
      JOIN  users ur              ON ur.id     = b.resident_id
      LEFT JOIN users up          ON up.id     = b.professional_id
      LEFT JOIN professionals p   ON p.user_id = b.professional_id
      WHERE b.id = $1
    `, [req.params.id]);

    const row = bookingRows[0] as Record<string, unknown> | undefined;

    if (!row) {
      fail(res, 'Booking not found', 404);
      return;
    }

    const { id: userId, role } = req.user!;
    const isResident    = row.resident_id === userId;
    const isAssignedPro = row.professional_id === userId;

    let canViewAsPro = false;
    if (role === 'professional') {
      if (['pending_quote', 'quoted'].includes(row.status as string)) {
        const { rows: catRows } = await db.query(`
          SELECT 1 FROM professional_categories pc
          JOIN professionals p ON p.id = pc.professional_id
          WHERE p.user_id = $1 AND pc.category_id = $2
        `, [userId, row.category_id]);
        if (catRows.length > 0) canViewAsPro = true;
      }
      if (!canViewAsPro) {
        const { rows: qRows } = await db.query(
          'SELECT 1 FROM quotes WHERE booking_id = $1 AND professional_id = $2',
          [req.params.id, userId]
        );
        if (qRows.length > 0) canViewAsPro = true;
      }
    }

    if (!isResident && !isAssignedPro && !canViewAsPro && role !== 'admin') {
      fail(res, 'Access denied', 403);
      return;
    }

    const {
      resident_name, resident_phone,
      professional_name, professional_phone, professional_rating,
      ...booking
    } = row;

    const { rows: quotes } = await db.query(`
      SELECT q.*, u.name AS professional_name, p.rating AS professional_rating
      FROM quotes q
      JOIN users u ON u.id = q.professional_id
      LEFT JOIN professionals p ON p.user_id = q.professional_id
      WHERE q.booking_id = $1
      ORDER BY q.created_at ASC
    `, [req.params.id]);

    const { rows: msgRows } = await db.query(`
      SELECT m.*, u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.booking_id = $1
      ORDER BY m.created_at DESC
      LIMIT 10
    `, [req.params.id]);
    const messages = msgRows.reverse();

    const { rows: revRows } = await db.query(`
      SELECT r.*, u.name AS reviewer_name
      FROM reviews r
      JOIN users u ON u.id = r.resident_id
      WHERE r.booking_id = $1
    `, [req.params.id]);
    const review = revRows[0] ?? null;

    ok(res, {
      ...booking,
      resident: {
        id: booking.resident_id,
        name: resident_name,
        phone: resident_phone,
      },
      professional: booking.professional_id
        ? {
            id: booking.professional_id,
            name: professional_name,
            phone: professional_phone,
            rating: professional_rating,
          }
        : null,
      quotes,
      messages,
      review,
    });
  } catch (err) {
    console.error('[GET /bookings/:id]', err);
    fail(res, 'Could not fetch booking', 500);
  }
});

// ── PATCH /api/bookings/:id/status ────────────────────────────────────────────
router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body as { status?: string };
    const { id: userId, role } = req.user!;

    if (!status) {
      fail(res, 'status is required');
      return;
    }

    const { rows: bRows } = await db.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    const booking = bRows[0] as Record<string, unknown> | undefined;

    if (!booking) {
      fail(res, 'Booking not found', 404);
      return;
    }

    const current = booking.status as string;

    if (role === 'professional') {
      if (booking.professional_id !== userId) {
        fail(res, 'You are not the assigned professional for this booking', 403);
        return;
      }
      if (status === 'in_progress') {
        if (current !== 'confirmed') {
          fail(res, "Can only mark 'in_progress' from 'confirmed'");
          return;
        }
      } else if (status === 'completed') {
        if (current !== 'in_progress') {
          fail(res, "Can only mark 'completed' from 'in_progress'");
          return;
        }
      } else {
        fail(res, "Professionals may only set status to 'in_progress' or 'completed'");
        return;
      }
    } else if (role === 'resident') {
      if (booking.resident_id !== userId) {
        fail(res, 'You are not the resident on this booking', 403);
        return;
      }
      if (status !== 'cancelled') {
        fail(res, 'Residents may only cancel bookings');
        return;
      }
      if (!['pending_quote', 'quoted', 'confirmed'].includes(current)) {
        fail(res, `Cannot cancel a booking with status '${current}'`);
        return;
      }
    } else {
      fail(res, 'Not authorised to change booking status', 403);
      return;
    }

    await db.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, req.params.id]);

    if (status === 'completed' && booking.professional_id) {
      await db.query(
        'UPDATE professionals SET total_jobs = total_jobs + 1 WHERE user_id = $1',
        [booking.professional_id]
      );
    }

    const { rows: updated } = await db.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    getIo()?.to(`booking_${req.params.id}`).emit('booking_status_changed', updated[0]);

    ok(res, updated[0]);
  } catch (err) {
    console.error('[PATCH /bookings/:id/status]', err);
    fail(res, 'Could not update booking status', 500);
  }
});

export default router;
