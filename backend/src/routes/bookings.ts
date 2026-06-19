import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';
import { getIo } from '../socket';

const router = Router();
router.use(authenticate);

// ── GET /api/bookings ──────────────────────────────────────────────────────────
router.get('/', (req: AuthRequest, res: Response): void => {
  try {
    const { id: userId, role } = req.user!;
    let rows: unknown[];

    if (role === 'resident') {
      rows = db.prepare(`
        SELECT b.*, sc.name AS category_name,
               up.name AS professional_name
        FROM bookings b
        JOIN service_categories sc ON sc.id = b.category_id
        LEFT JOIN users up ON up.id = b.professional_id
        WHERE b.resident_id = ?
        ORDER BY b.created_at DESC
      `).all(userId);
    } else if (role === 'professional') {
      // Own assigned bookings + open pending_quote bookings in their categories.
      rows = db.prepare(`
        SELECT DISTINCT b.*, sc.name AS category_name,
               ur.name AS resident_name
        FROM bookings b
        JOIN service_categories sc ON sc.id = b.category_id
        JOIN users ur ON ur.id = b.resident_id
        WHERE b.professional_id = ?
           OR (b.status IN ('pending_quote','quoted') AND b.category_id IN (
                 SELECT pc.category_id
                 FROM professional_categories pc
                 JOIN professionals p ON p.id = pc.professional_id
                 WHERE p.user_id = ?
               ))
        ORDER BY b.created_at DESC
      `).all(userId, userId);
    } else {
      // admin — all bookings
      rows = db.prepare(`
        SELECT b.*, sc.name AS category_name,
               ur.name AS resident_name,
               up.name AS professional_name
        FROM bookings b
        JOIN service_categories sc ON sc.id = b.category_id
        JOIN users ur ON ur.id = b.resident_id
        LEFT JOIN users up ON up.id = b.professional_id
        ORDER BY b.created_at DESC
      `).all();
    }

    ok(res, rows);
  } catch (err) {
    console.error('[GET /bookings]', err);
    fail(res, 'Could not fetch bookings', 500);
  }
});

// ── POST /api/bookings  (resident only) ────────────────────────────────────────
router.post('/', requireRole('resident'), (req: AuthRequest, res: Response): void => {
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
    if (address.trim().length > 300)             { fail(res, 'address must be 300 characters or fewer'); return; }
    if (problem_description.trim().length > 1000) { fail(res, 'problem_description must be 1000 characters or fewer'); return; }
    const parsedDate = new Date(scheduled_at);
    if (isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
      fail(res, 'scheduled_at must be a valid future date'); return;
    }

    const cat = db
      .prepare('SELECT id FROM service_categories WHERE id = ? AND is_active = 1')
      .get(category_id);
    if (!cat) {
      fail(res, `Service category '${category_id}' not found`);
      return;
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO bookings (id, resident_id, category_id, scheduled_at, address, problem_description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.user!.id, category_id, scheduled_at, address, problem_description);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);

    // Notify professionals who joined this category's socket room.
    getIo()?.to(`category_${category_id}`).emit('new_booking_request', booking);

    ok(res, booking, 201);
  } catch (err) {
    console.error('[POST /bookings]', err);
    fail(res, 'Could not create booking', 500);
  }
});

// ── GET /api/bookings/:id ──────────────────────────────────────────────────────
router.get('/:id', (req: AuthRequest, res: Response): void => {
  try {
    const row = db.prepare(`
      SELECT b.*,
             sc.name  AS category_name,
             ur.name  AS resident_name,  ur.phone AS resident_phone,
             up.name  AS professional_name, up.phone AS professional_phone,
             p.rating AS professional_rating
      FROM bookings b
      JOIN  service_categories sc ON sc.id       = b.category_id
      JOIN  users ur              ON ur.id        = b.resident_id
      LEFT JOIN users up          ON up.id        = b.professional_id
      LEFT JOIN professionals p   ON p.user_id    = b.professional_id
      WHERE b.id = ?
    `).get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      fail(res, 'Booking not found', 404);
      return;
    }

    const { id: userId, role } = req.user!;
    const isResident    = row.resident_id === userId;
    const isAssignedPro = row.professional_id === userId;

    // A professional can also view a booking if it's open in their category
    // (so they can read the details before quoting) or if they already quoted.
    const canViewAsPro = role === 'professional' && (
      (
        ['pending_quote', 'quoted'].includes(row.status as string) &&
        !!db.prepare(`
          SELECT 1 FROM professional_categories pc
          JOIN professionals p ON p.id = pc.professional_id
          WHERE p.user_id = ? AND pc.category_id = ?
        `).get(userId, row.category_id)
      ) ||
      !!db.prepare(
        'SELECT 1 FROM quotes WHERE booking_id = ? AND professional_id = ?'
      ).get(req.params.id, userId)
    );

    if (!isResident && !isAssignedPro && !canViewAsPro && role !== 'admin') {
      fail(res, 'Access denied', 403);
      return;
    }

    const {
      resident_name, resident_phone,
      professional_name, professional_phone, professional_rating,
      ...booking
    } = row;

    const quotes = db.prepare(`
      SELECT q.*, u.name AS professional_name, p.rating AS professional_rating
      FROM quotes q
      JOIN users u ON u.id = q.professional_id
      LEFT JOIN professionals p ON p.user_id = q.professional_id
      WHERE q.booking_id = ?
      ORDER BY q.created_at ASC
    `).all(req.params.id);

    // Last 10 messages returned in ascending order (oldest first).
    const messages = (db.prepare(`
      SELECT m.*, u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.booking_id = ?
      ORDER BY m.created_at DESC
      LIMIT 10
    `).all(req.params.id) as unknown[]).reverse();

    const review = db.prepare(`
      SELECT r.*, u.name AS reviewer_name
      FROM reviews r
      JOIN users u ON u.id = r.resident_id
      WHERE r.booking_id = ?
    `).get(req.params.id) ?? null;

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
router.patch('/:id/status', (req: AuthRequest, res: Response): void => {
  try {
    const { status } = req.body as { status?: string };
    const { id: userId, role } = req.user!;

    if (!status) {
      fail(res, 'status is required');
      return;
    }

    const booking = db
      .prepare('SELECT * FROM bookings WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;

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

    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);

    if (status === 'completed' && booking.professional_id) {
      db.prepare(
        'UPDATE professionals SET total_jobs = total_jobs + 1 WHERE user_id = ?'
      ).run(booking.professional_id);
    }

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    getIo()?.to(`booking_${req.params.id}`).emit('booking_status_changed', updated);

    ok(res, updated);
  } catch (err) {
    console.error('[PATCH /bookings/:id/status]', err);
    fail(res, 'Could not update booking status', 500);
  }
});

export default router;
