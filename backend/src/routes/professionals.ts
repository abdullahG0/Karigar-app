import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();

// Shared SELECT clause — joins users and aggregates category objects.
// PG: json_agg + json_build_object instead of SQLite json_group_array + json_object.
// PG returns native JS booleans and parsed JSON — no manual casting needed.
const SELECT_CORE = `
  SELECT
    p.id, p.user_id, p.bio, p.hourly_rate, p.is_verified, p.is_available,
    p.rating, p.total_jobs, p.created_at,
    u.name, u.phone, u.society_id,
    COALESCE(
      json_agg(
        json_build_object('id', sc.id, 'name', sc.name, 'icon_name', sc.icon_name)
      ) FILTER (WHERE sc.id IS NOT NULL),
      '[]'::json
    ) AS categories
  FROM professionals p
  JOIN  users u ON u.id = p.user_id
  LEFT JOIN professional_categories pc ON pc.professional_id = p.id
  LEFT JOIN service_categories sc ON sc.id = pc.category_id
`;

// GET /api/professionals
// Query params: ?category_id=&society_id=
// Only returns is_verified = true professionals.
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_id, society_id } = req.query as {
      category_id?: string;
      society_id?: string;
    };

    const conditions: string[] = ['p.is_verified = true'];
    const params: unknown[] = [];

    if (category_id) {
      params.push(category_id);
      conditions.push(
        `p.id IN (SELECT professional_id FROM professional_categories WHERE category_id = $${params.length})`
      );
    }
    if (society_id) {
      params.push(society_id);
      conditions.push(`u.society_id = $${params.length}`);
    }

    const sql = `
      ${SELECT_CORE}
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.id, u.name, u.phone, u.society_id
      ORDER BY p.rating DESC, p.total_jobs DESC
    `;

    const { rows } = await db.query(sql, params);
    ok(res, rows);
  } catch (err) {
    console.error('[GET /professionals]', err);
    fail(res, 'Could not fetch professionals', 500);
  }
});

// GET /api/professionals/me  — own profile (professional only). Must be before /:id.
router.get('/me', authenticate, requireRole('professional'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(
      `${SELECT_CORE} WHERE p.user_id = $1 GROUP BY p.id, u.name, u.phone, u.society_id`,
      [req.user!.id]
    );
    const row = rows[0];
    if (!row) {
      fail(res, 'Professional profile not found', 404);
      return;
    }
    ok(res, row);
  } catch (err) {
    console.error('[GET /professionals/me]', err);
    fail(res, 'Could not fetch professional profile', 500);
  }
});

// GET /api/professionals/:id  — full profile + last 5 reviews
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(
      `${SELECT_CORE} WHERE p.id = $1 GROUP BY p.id, u.name, u.phone, u.society_id`,
      [req.params.id]
    );
    const row = rows[0];
    if (!row) {
      fail(res, 'Professional not found', 404);
      return;
    }

    const { rows: reviews } = await db.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             u.name AS reviewer_name
      FROM reviews r
      JOIN users u ON u.id = r.resident_id
      WHERE r.professional_id = $1
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [row.user_id as string]);

    ok(res, { ...row, recent_reviews: reviews });
  } catch (err) {
    console.error('[GET /professionals/:id]', err);
    fail(res, 'Could not fetch professional', 500);
  }
});

// PATCH /api/professionals/me/availability  (professional only)
// Must be registered BEFORE /:id to avoid param capture.
router.patch(
  '/me/availability',
  authenticate,
  requireRole('professional'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { is_available } = req.body as { is_available?: boolean };
      if (is_available === undefined) {
        fail(res, 'is_available (boolean) is required');
        return;
      }

      const { rows: profRows } = await db.query(
        'SELECT id FROM professionals WHERE user_id = $1',
        [req.user!.id]
      );
      const prof = profRows[0] as { id: string } | undefined;

      if (!prof) {
        fail(res, 'Professional profile not found', 404);
        return;
      }

      await db.query('UPDATE professionals SET is_available = $1 WHERE id = $2', [is_available, prof.id]);

      const { rows } = await db.query(
        `${SELECT_CORE} WHERE p.id = $1 GROUP BY p.id, u.name, u.phone, u.society_id`,
        [prof.id]
      );
      ok(res, rows[0]);
    } catch (err) {
      console.error('[PATCH /professionals/me/availability]', err);
      fail(res, 'Could not update availability', 500);
    }
  }
);

// PATCH /api/professionals/me  — update bio, hourly_rate, categories
router.patch('/me', authenticate, requireRole('professional'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bio, hourly_rate, category_ids } = req.body as {
      bio?: string;
      hourly_rate?: number;
      category_ids?: string[];
    };

    const { rows: profRows } = await db.query(
      'SELECT id FROM professionals WHERE user_id = $1',
      [req.user!.id]
    );
    const prof = profRows[0] as { id: string } | undefined;

    if (!prof) {
      fail(res, 'Professional profile not found', 404);
      return;
    }

    await db.query(`
      UPDATE professionals SET
        bio         = COALESCE($1, bio),
        hourly_rate = COALESCE($2, hourly_rate)
      WHERE id = $3
    `, [bio ?? null, hourly_rate ?? null, prof.id]);

    if (Array.isArray(category_ids)) {
      await db.query('DELETE FROM professional_categories WHERE professional_id = $1', [prof.id]);
      for (const catId of category_ids) {
        await db.query(
          'INSERT INTO professional_categories (professional_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [prof.id, catId]
        );
      }
    }

    const { rows } = await db.query(
      `${SELECT_CORE} WHERE p.id = $1 GROUP BY p.id, u.name, u.phone, u.society_id`,
      [prof.id]
    );
    ok(res, rows[0]);
  } catch (err) {
    console.error('[PATCH /professionals/me]', err);
    fail(res, 'Could not update profile', 500);
  }
});

export default router;
