import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
router.use(authenticate, requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', (_req: AuthRequest, res: Response): void => {
  try {
    const total_bookings = (db.prepare(
      'SELECT COUNT(*) AS n FROM bookings'
    ).get() as { n: number }).n;

    const active_bookings = (db.prepare(
      "SELECT COUNT(*) AS n FROM bookings WHERE status IN ('pending_quote','quoted','confirmed','in_progress')"
    ).get() as { n: number }).n;

    const total_professionals = (db.prepare(
      'SELECT COUNT(*) AS n FROM professionals'
    ).get() as { n: number }).n;

    const total_residents = (db.prepare(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'resident'"
    ).get() as { n: number }).n;

    ok(res, { total_bookings, active_bookings, total_professionals, total_residents });
  } catch (err) {
    console.error('[GET /admin/stats]', err);
    fail(res, 'Could not fetch stats', 500);
  }
});

// GET /api/admin/stats/categories
router.get('/stats/categories', (_req: AuthRequest, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT sc.name AS category_name, COUNT(b.id) AS booking_count
      FROM service_categories sc
      LEFT JOIN bookings b ON b.category_id = sc.id
      WHERE sc.is_active = 1
      GROUP BY sc.id, sc.name
      ORDER BY booking_count DESC
    `).all();
    ok(res, rows);
  } catch (err) {
    console.error('[GET /admin/stats/categories]', err);
    fail(res, 'Could not fetch category stats', 500);
  }
});

// GET /api/admin/bookings
router.get('/bookings', (_req: AuthRequest, res: Response): void => {
  try {
    const rows = db.prepare(`
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
    `).all();
    ok(res, rows);
  } catch (err) {
    console.error('[GET /admin/bookings]', err);
    fail(res, 'Could not fetch bookings', 500);
  }
});

// GET /api/admin/professionals
router.get('/professionals', (_req: AuthRequest, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT p.id, p.user_id, p.bio, p.hourly_rate, p.is_verified, p.is_available,
             p.rating, p.total_jobs, p.created_at,
             u.name, u.phone, u.society_id,
             COALESCE(
               json_group_array(
                 json_object('id', sc.id, 'name', sc.name)
               ) FILTER (WHERE sc.id IS NOT NULL),
               '[]'
             ) AS categories
      FROM professionals p
      JOIN  users u ON u.id = p.user_id
      LEFT JOIN professional_categories pc ON pc.professional_id = p.id
      LEFT JOIN service_categories sc      ON sc.id = pc.category_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all() as Record<string, unknown>[];

    const parsed = rows.map((row) => ({
      ...row,
      categories:   JSON.parse(row.categories as string),
      is_verified:  Boolean(row.is_verified),
      is_available: Boolean(row.is_available),
    }));
    ok(res, parsed);
  } catch (err) {
    console.error('[GET /admin/professionals]', err);
    fail(res, 'Could not fetch professionals', 500);
  }
});

// GET /api/admin/residents
router.get('/residents', (_req: AuthRequest, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.name, u.phone, u.society_id, u.created_at,
             s.name AS society_name,
             COUNT(b.id) AS booking_count
      FROM users u
      LEFT JOIN societies s  ON s.id = u.society_id
      LEFT JOIN bookings b   ON b.resident_id = u.id
      WHERE u.role = 'resident'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();
    ok(res, rows);
  } catch (err) {
    console.error('[GET /admin/residents]', err);
    fail(res, 'Could not fetch residents', 500);
  }
});

// PATCH /api/admin/professionals/:id/verify  (toggle)
router.patch('/professionals/:id/verify', (req: AuthRequest, res: Response): void => {
  try {
    const pro = db
      .prepare('SELECT id, is_verified FROM professionals WHERE id = ?')
      .get(req.params.id) as { id: string; is_verified: number } | undefined;
    if (!pro) { fail(res, 'Professional not found', 404); return; }

    const next = pro.is_verified ? 0 : 1;
    db.prepare('UPDATE professionals SET is_verified = ? WHERE id = ?').run(next, req.params.id);
    ok(res, { id: req.params.id, is_verified: Boolean(next) });
  } catch (err) {
    console.error('[PATCH /admin/professionals/:id/verify]', err);
    fail(res, 'Could not update verification', 500);
  }
});

// POST /api/admin/professionals  — create new professional account
router.post('/professionals', (req: AuthRequest, res: Response): void => {
  try {
    const { name, phone, password, bio, hourly_rate, category_ids, is_verified, society_id } = req.body as {
      name?: string; phone?: string; password?: string; bio?: string;
      hourly_rate?: number; category_ids?: string[]; is_verified?: boolean; society_id?: string;
    };

    if (!name?.trim() || !phone?.trim() || !password?.trim()) {
      fail(res, 'name, phone, and password are required'); return;
    }

    const taken = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone.trim());
    if (taken) { fail(res, 'A user with this phone number already exists', 409); return; }

    const pwHash  = bcrypt.hashSync(password.trim(), 10);
    const userId  = uuidv4();
    const proId   = uuidv4();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, name, phone, password_hash, role, society_id)
        VALUES (?, ?, ?, ?, 'professional', ?)
      `).run(userId, name.trim(), phone.trim(), pwHash, society_id ?? 'soc_pvc_isl');

      db.prepare(`
        INSERT INTO professionals (id, user_id, bio, hourly_rate, is_verified, is_available, rating, total_jobs)
        VALUES (?, ?, ?, ?, ?, 1, 0, 0)
      `).run(proId, userId, bio?.trim() ?? null, hourly_rate ?? 0, is_verified ? 1 : 0);

      if (Array.isArray(category_ids)) {
        const ins = db.prepare('INSERT INTO professional_categories (professional_id, category_id) VALUES (?, ?)');
        for (const catId of category_ids) ins.run(proId, catId);
      }
    })();

    ok(res, { id: proId, user_id: userId }, 201);
  } catch (err) {
    console.error('[POST /admin/professionals]', err);
    fail(res, 'Could not create professional', 500);
  }
});

// PATCH /api/admin/professionals/:id  — edit details
router.patch('/professionals/:id', (req: AuthRequest, res: Response): void => {
  try {
    const pro = db
      .prepare('SELECT id, user_id FROM professionals WHERE id = ?')
      .get(req.params.id) as { id: string; user_id: string } | undefined;
    if (!pro) { fail(res, 'Professional not found', 404); return; }

    const { name, phone, password, bio, hourly_rate, category_ids, is_verified, is_available } = req.body as {
      name?: string; phone?: string; password?: string; bio?: string;
      hourly_rate?: number; category_ids?: string[];
      is_verified?: boolean; is_available?: boolean;
    };

    db.transaction(() => {
      // Update user fields
      if (name !== undefined || phone !== undefined || password !== undefined) {
        const pwHash = password?.trim() ? bcrypt.hashSync(password.trim(), 10) : null;
        db.prepare(`
          UPDATE users SET
            name          = COALESCE(?, name),
            phone         = COALESCE(?, phone),
            password_hash = COALESCE(?, password_hash)
          WHERE id = ?
        `).run(name?.trim() ?? null, phone?.trim() ?? null, pwHash, pro.user_id);
      }

      // Update professional profile
      db.prepare(`
        UPDATE professionals SET
          bio          = COALESCE(?, bio),
          hourly_rate  = COALESCE(?, hourly_rate),
          is_verified  = COALESCE(?, is_verified),
          is_available = COALESCE(?, is_available)
        WHERE id = ?
      `).run(
        bio !== undefined ? (bio.trim() || null) : null,
        hourly_rate ?? null,
        is_verified  !== undefined ? (is_verified  ? 1 : 0) : null,
        is_available !== undefined ? (is_available ? 1 : 0) : null,
        req.params.id,
      );

      // Replace categories if provided
      if (Array.isArray(category_ids)) {
        db.prepare('DELETE FROM professional_categories WHERE professional_id = ?').run(req.params.id);
        const ins = db.prepare('INSERT INTO professional_categories (professional_id, category_id) VALUES (?, ?)');
        for (const catId of category_ids) ins.run(req.params.id, catId);
      }
    })();

    ok(res, { id: req.params.id });
  } catch (err) {
    console.error('[PATCH /admin/professionals/:id]', err);
    fail(res, 'Could not update professional', 500);
  }
});

// DELETE /api/admin/professionals/:id
router.delete('/professionals/:id', (req: AuthRequest, res: Response): void => {
  try {
    const pro = db
      .prepare('SELECT id, user_id FROM professionals WHERE id = ?')
      .get(req.params.id) as { id: string; user_id: string } | undefined;
    if (!pro) { fail(res, 'Professional not found', 404); return; }

    const active = (db.prepare(`
      SELECT COUNT(*) AS n FROM bookings
      WHERE professional_id = ? AND status NOT IN ('completed','cancelled')
    `).get(pro.user_id) as { n: number }).n;

    if (active > 0) {
      fail(res, `Cannot delete — ${active} active booking(s) still assigned. Suspend them instead.`, 409);
      return;
    }

    db.transaction(() => {
      db.prepare('DELETE FROM professional_categories WHERE professional_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quotes WHERE professional_id = ?').run(pro.user_id);
      db.prepare('UPDATE bookings SET professional_id = NULL WHERE professional_id = ?').run(pro.user_id);
      db.prepare('DELETE FROM professionals WHERE id = ?').run(req.params.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(pro.user_id);
    })();

    ok(res, { deleted: true });
  } catch (err) {
    console.error('[DELETE /admin/professionals/:id]', err);
    fail(res, 'Could not delete professional', 500);
  }
});

// PATCH /api/admin/professionals/:id/suspend
router.patch('/professionals/:id/suspend', (req: AuthRequest, res: Response): void => {
  try {
    const pro = db
      .prepare('SELECT id FROM professionals WHERE id = ?')
      .get(req.params.id) as { id: string } | undefined;
    if (!pro) { fail(res, 'Professional not found', 404); return; }

    db.prepare('UPDATE professionals SET is_available = 0 WHERE id = ?').run(req.params.id);
    ok(res, { id: req.params.id, is_available: false });
  } catch (err) {
    console.error('[PATCH /admin/professionals/:id/suspend]', err);
    fail(res, 'Could not suspend professional', 500);
  }
});

export default router;
