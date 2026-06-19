import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();

// Shared SELECT clause — joins users and aggregates category objects.
const SELECT_CORE = `
  SELECT
    p.id, p.user_id, p.bio, p.hourly_rate, p.is_verified, p.is_available,
    p.rating, p.total_jobs, p.created_at,
    u.name, u.phone, u.society_id,
    COALESCE(
      json_group_array(
        json_object('id', sc.id, 'name', sc.name, 'icon_name', sc.icon_name)
      ) FILTER (WHERE sc.id IS NOT NULL),
      '[]'
    ) AS categories
  FROM professionals p
  JOIN  users u ON u.id = p.user_id
  LEFT JOIN professional_categories pc ON pc.professional_id = p.id
  LEFT JOIN service_categories sc ON sc.id = pc.category_id
`;

function parseProfessional(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    categories:   JSON.parse(row.categories as string),
    is_verified:  Boolean(row.is_verified),
    is_available: Boolean(row.is_available),
  };
}

// GET /api/professionals
// Query params: ?category_id=&society_id=
// Only returns is_verified = 1 professionals.
router.get('/', (req: Request, res: Response): void => {
  try {
    const { category_id, society_id } = req.query as {
      category_id?: string;
      society_id?: string;
    };

    // Build WHERE clause dynamically to avoid passing nulls for the IS NULL trick.
    const conditions: string[] = ['p.is_verified = 1'];
    const params: unknown[] = [];

    if (category_id) {
      conditions.push(
        'p.id IN (SELECT professional_id FROM professional_categories WHERE category_id = ?)'
      );
      params.push(category_id);
    }
    if (society_id) {
      conditions.push('u.society_id = ?');
      params.push(society_id);
    }

    const sql = `
      ${SELECT_CORE}
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.id
      ORDER BY p.rating DESC, p.total_jobs DESC
    `;

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    ok(res, rows.map(parseProfessional));
  } catch (err) {
    console.error('[GET /professionals]', err);
    fail(res, 'Could not fetch professionals', 500);
  }
});

// GET /api/professionals/me  — own profile (professional only). Must be before /:id.
router.get('/me', authenticate, requireRole('professional'), (req: AuthRequest, res: Response): void => {
  try {
    const row = db
      .prepare(`${SELECT_CORE} WHERE p.user_id = ? GROUP BY p.id`)
      .get(req.user!.id) as Record<string, unknown> | undefined;

    if (!row) {
      fail(res, 'Professional profile not found', 404);
      return;
    }
    ok(res, parseProfessional(row));
  } catch (err) {
    console.error('[GET /professionals/me]', err);
    fail(res, 'Could not fetch professional profile', 500);
  }
});

// GET /api/professionals/:id  — full profile + last 5 reviews
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const row = db
      .prepare(`${SELECT_CORE} WHERE p.id = ? GROUP BY p.id`)
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      fail(res, 'Professional not found', 404);
      return;
    }

    // Last 5 reviews for this professional.
    // reviews.professional_id references users.id, so we use the user_id field.
    const reviews = db
      .prepare(`
        SELECT r.id, r.rating, r.comment, r.created_at,
               u.name AS reviewer_name
        FROM reviews r
        JOIN users u ON u.id = r.resident_id
        WHERE r.professional_id = ?
        ORDER BY r.created_at DESC
        LIMIT 5
      `)
      .all(row.user_id as string);

    ok(res, { ...parseProfessional(row), recent_reviews: reviews });
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
  (req: AuthRequest, res: Response): void => {
    try {
      const { is_available } = req.body as { is_available?: boolean };
      if (is_available === undefined) {
        fail(res, 'is_available (boolean) is required');
        return;
      }

      const prof = db
        .prepare('SELECT id FROM professionals WHERE user_id = ?')
        .get(req.user!.id) as { id: string } | undefined;

      if (!prof) {
        fail(res, 'Professional profile not found', 404);
        return;
      }

      db.prepare('UPDATE professionals SET is_available = ? WHERE id = ?').run(
        is_available ? 1 : 0,
        prof.id
      );

      const updated = db
        .prepare(`${SELECT_CORE} WHERE p.id = ? GROUP BY p.id`)
        .get(prof.id) as Record<string, unknown>;

      ok(res, parseProfessional(updated));
    } catch (err) {
      console.error('[PATCH /professionals/me/availability]', err);
      fail(res, 'Could not update availability', 500);
    }
  }
);

// PATCH /api/professionals/me  — update bio, hourly_rate, categories
router.patch('/me', authenticate, requireRole('professional'), (req: AuthRequest, res: Response): void => {
  try {
    const { bio, hourly_rate, category_ids } = req.body as {
      bio?: string;
      hourly_rate?: number;
      category_ids?: string[];
    };

    const prof = db
      .prepare('SELECT id FROM professionals WHERE user_id = ?')
      .get(req.user!.id) as { id: string } | undefined;

    if (!prof) {
      fail(res, 'Professional profile not found', 404);
      return;
    }

    db.prepare(`
      UPDATE professionals SET
        bio         = COALESCE(?, bio),
        hourly_rate = COALESCE(?, hourly_rate)
      WHERE id = ?
    `).run(bio ?? null, hourly_rate ?? null, prof.id);

    if (Array.isArray(category_ids)) {
      db.prepare('DELETE FROM professional_categories WHERE professional_id = ?').run(prof.id);
      const ins = db.prepare(
        'INSERT OR IGNORE INTO professional_categories (professional_id, category_id) VALUES (?, ?)'
      );
      for (const catId of category_ids) {
        ins.run(prof.id, catId);
      }
    }

    const updated = db
      .prepare(`${SELECT_CORE} WHERE p.id = ? GROUP BY p.id`)
      .get(prof.id) as Record<string, unknown>;

    ok(res, parseProfessional(updated));
  } catch (err) {
    console.error('[PATCH /professionals/me]', err);
    fail(res, 'Could not update profile', 500);
  }
});

export default router;
