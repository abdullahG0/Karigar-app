import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
router.use(authenticate, requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [r1, r2, r3, r4] = await Promise.all([
      db.query('SELECT COUNT(*) AS n FROM bookings'),
      db.query("SELECT COUNT(*) AS n FROM bookings WHERE status IN ('pending_quote','quoted','confirmed','in_progress')"),
      db.query('SELECT COUNT(*) AS n FROM professionals'),
      db.query("SELECT COUNT(*) AS n FROM users WHERE role = 'resident'"),
    ]);

    ok(res, {
      total_bookings:      parseInt(r1.rows[0].n, 10),
      active_bookings:     parseInt(r2.rows[0].n, 10),
      total_professionals: parseInt(r3.rows[0].n, 10),
      total_residents:     parseInt(r4.rows[0].n, 10),
    });
  } catch (err) {
    console.error('[GET /admin/stats]', err);
    fail(res, 'Could not fetch stats', 500);
  }
});

// GET /api/admin/stats/categories
router.get('/stats/categories', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(`
      SELECT sc.name AS category_name, COUNT(b.id) AS booking_count
      FROM service_categories sc
      LEFT JOIN bookings b ON b.category_id = sc.id
      WHERE sc.is_active = true
      GROUP BY sc.id, sc.name
      ORDER BY booking_count DESC
    `);
    ok(res, rows);
  } catch (err) {
    console.error('[GET /admin/stats/categories]', err);
    fail(res, 'Could not fetch category stats', 500);
  }
});

// GET /api/admin/bookings
router.get('/bookings', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(`
      SELECT b.id, b.status, b.scheduled_at, b.created_at, b.address,
             b.problem_description, b.quote_amount,
             sc.name  AS category_name,
             ur.name  AS resident_name,
             up.name  AS professional_name
      FROM bookings b
      JOIN  service_categories sc ON sc.id = b.category_id
      JOIN  users ur              ON ur.id = b.resident_id
      LEFT JOIN users up          ON up.id = b.professional_id
      ORDER BY b.created_at DESC
    `);
    ok(res, rows);
  } catch (err) {
    console.error('[GET /admin/bookings]', err);
    fail(res, 'Could not fetch bookings', 500);
  }
});

// GET /api/admin/professionals
router.get('/professionals', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.user_id, p.bio, p.hourly_rate, p.is_verified, p.is_available,
             p.rating, p.total_jobs, p.created_at,
             u.name, u.phone, u.society_id,
             COALESCE(
               json_agg(json_build_object('id', sc.id, 'name', sc.name))
                 FILTER (WHERE sc.id IS NOT NULL),
               '[]'::json
             ) AS categories
      FROM professionals p
      JOIN  users u ON u.id = p.user_id
      LEFT JOIN professional_categories pc ON pc.professional_id = p.id
      LEFT JOIN service_categories sc      ON sc.id = pc.category_id
      GROUP BY p.id, u.name, u.phone, u.society_id
      ORDER BY p.created_at DESC
    `);
    ok(res, rows);
  } catch (err) {
    console.error('[GET /admin/professionals]', err);
    fail(res, 'Could not fetch professionals', 500);
  }
});

// GET /api/admin/residents
router.get('/residents', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.phone, u.society_id, u.created_at,
             s.name AS society_name,
             COUNT(b.id) AS booking_count
      FROM users u
      LEFT JOIN societies s  ON s.id = u.society_id
      LEFT JOIN bookings b   ON b.resident_id = u.id
      WHERE u.role = 'resident'
      GROUP BY u.id, s.name
      ORDER BY u.created_at DESC
    `);
    ok(res, rows);
  } catch (err) {
    console.error('[GET /admin/residents]', err);
    fail(res, 'Could not fetch residents', 500);
  }
});

// PATCH /api/admin/professionals/:id/verify  (toggle)
router.patch('/professionals/:id/verify', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(
      'SELECT id, is_verified FROM professionals WHERE id = $1',
      [req.params.id]
    );
    const pro = rows[0] as { id: string; is_verified: boolean } | undefined;
    if (!pro) { fail(res, 'Professional not found', 404); return; }

    const next = !pro.is_verified;
    await db.query('UPDATE professionals SET is_verified = $1 WHERE id = $2', [next, req.params.id]);
    ok(res, { id: req.params.id, is_verified: next });
  } catch (err) {
    console.error('[PATCH /admin/professionals/:id/verify]', err);
    fail(res, 'Could not update verification', 500);
  }
});

// POST /api/admin/professionals  — create new professional account
router.post('/professionals', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, password, bio, hourly_rate, category_ids, is_verified, society_id } = req.body as {
      name?: string; phone?: string; password?: string; bio?: string;
      hourly_rate?: number; category_ids?: string[]; is_verified?: boolean; society_id?: string;
    };

    if (!name?.trim() || !phone?.trim() || !password?.trim()) {
      fail(res, 'name, phone, and password are required'); return;
    }

    const { rows: taken } = await db.query('SELECT id FROM users WHERE phone = $1', [phone.trim()]);
    if (taken.length > 0) { fail(res, 'A user with this phone number already exists', 409); return; }

    const pwHash  = bcrypt.hashSync(password.trim(), 10);
    const userId  = uuidv4();
    const proId   = uuidv4();

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO users (id, name, phone, password_hash, role, society_id)
        VALUES ($1,$2,$3,$4,'professional',$5)
      `, [userId, name.trim(), phone.trim(), pwHash, society_id ?? 'soc_pvc_isl']);

      await client.query(`
        INSERT INTO professionals (id, user_id, bio, hourly_rate, is_verified, is_available, rating, total_jobs)
        VALUES ($1,$2,$3,$4,$5,true,0,0)
      `, [proId, userId, bio?.trim() ?? null, hourly_rate ?? 0, Boolean(is_verified)]);

      if (Array.isArray(category_ids)) {
        for (const catId of category_ids) {
          await client.query(
            'INSERT INTO professional_categories (professional_id, category_id) VALUES ($1,$2)',
            [proId, catId]
          );
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    ok(res, { id: proId, user_id: userId }, 201);
  } catch (err) {
    console.error('[POST /admin/professionals]', err);
    fail(res, 'Could not create professional', 500);
  }
});

// PATCH /api/admin/professionals/:id  — edit details
router.patch('/professionals/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: proRows } = await db.query(
      'SELECT id, user_id FROM professionals WHERE id = $1',
      [req.params.id]
    );
    const pro = proRows[0] as { id: string; user_id: string } | undefined;
    if (!pro) { fail(res, 'Professional not found', 404); return; }

    const { name, phone, password, bio, hourly_rate, category_ids, is_verified, is_available } = req.body as {
      name?: string; phone?: string; password?: string; bio?: string;
      hourly_rate?: number; category_ids?: string[];
      is_verified?: boolean; is_available?: boolean;
    };

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      if (name !== undefined || phone !== undefined || password !== undefined) {
        const pwHash = password?.trim() ? bcrypt.hashSync(password.trim(), 10) : null;
        await client.query(`
          UPDATE users SET
            name          = COALESCE($1, name),
            phone         = COALESCE($2, phone),
            password_hash = COALESCE($3, password_hash)
          WHERE id = $4
        `, [name?.trim() ?? null, phone?.trim() ?? null, pwHash, pro.user_id]);
      }

      await client.query(`
        UPDATE professionals SET
          bio          = COALESCE($1, bio),
          hourly_rate  = COALESCE($2, hourly_rate),
          is_verified  = COALESCE($3, is_verified),
          is_available = COALESCE($4, is_available)
        WHERE id = $5
      `, [
        bio !== undefined ? (bio.trim() || null) : null,
        hourly_rate ?? null,
        is_verified  !== undefined ? Boolean(is_verified)  : null,
        is_available !== undefined ? Boolean(is_available) : null,
        req.params.id,
      ]);

      if (Array.isArray(category_ids)) {
        await client.query('DELETE FROM professional_categories WHERE professional_id = $1', [req.params.id]);
        for (const catId of category_ids) {
          await client.query(
            'INSERT INTO professional_categories (professional_id, category_id) VALUES ($1,$2)',
            [req.params.id, catId]
          );
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    ok(res, { id: req.params.id });
  } catch (err) {
    console.error('[PATCH /admin/professionals/:id]', err);
    fail(res, 'Could not update professional', 500);
  }
});

// DELETE /api/admin/professionals/:id
router.delete('/professionals/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: proRows } = await db.query(
      'SELECT id, user_id FROM professionals WHERE id = $1',
      [req.params.id]
    );
    const pro = proRows[0] as { id: string; user_id: string } | undefined;
    if (!pro) { fail(res, 'Professional not found', 404); return; }

    const { rows: activeRows } = await db.query(`
      SELECT COUNT(*) AS n FROM bookings
      WHERE professional_id = $1 AND status NOT IN ('completed','cancelled')
    `, [pro.user_id]);
    const active = parseInt(activeRows[0].n, 10);

    if (active > 0) {
      fail(res, `Cannot delete — ${active} active booking(s) still assigned. Suspend them instead.`, 409);
      return;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM professional_categories WHERE professional_id = $1', [req.params.id]);
      await client.query('DELETE FROM quotes WHERE professional_id = $1', [pro.user_id]);
      await client.query('UPDATE bookings SET professional_id = NULL WHERE professional_id = $1', [pro.user_id]);
      await client.query('DELETE FROM professionals WHERE id = $1', [req.params.id]);
      await client.query('DELETE FROM users WHERE id = $1', [pro.user_id]);
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    ok(res, { deleted: true });
  } catch (err) {
    console.error('[DELETE /admin/professionals/:id]', err);
    fail(res, 'Could not delete professional', 500);
  }
});

// PATCH /api/admin/professionals/:id/suspend
router.patch('/professionals/:id/suspend', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(
      'SELECT id FROM professionals WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) { fail(res, 'Professional not found', 404); return; }

    await db.query('UPDATE professionals SET is_available = false WHERE id = $1', [req.params.id]);
    ok(res, { id: req.params.id, is_available: false });
  } catch (err) {
    console.error('[PATCH /admin/professionals/:id/suspend]', err);
    fail(res, 'Could not suspend professional', 500);
  }
});

export default router;
