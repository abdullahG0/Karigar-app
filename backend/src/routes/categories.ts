import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();

// GET /api/categories
router.get('/', (_req: Request, res: Response): void => {
  try {
    const rows = db
      .prepare('SELECT * FROM service_categories WHERE is_active = 1 ORDER BY name')
      .all();
    ok(res, rows);
  } catch (err) {
    console.error('[GET /categories]', err);
    fail(res, 'Could not fetch categories', 500);
  }
});

// GET /api/categories/:id
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const row = db
      .prepare('SELECT * FROM service_categories WHERE id = ?')
      .get(req.params.id);

    if (!row) {
      fail(res, 'Category not found', 404);
      return;
    }
    ok(res, row);
  } catch (err) {
    console.error('[GET /categories/:id]', err);
    fail(res, 'Could not fetch category', 500);
  }
});

// POST /api/categories  (admin only)
router.post('/', authenticate, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { name, icon_name, description, base_price_min, base_price_max } = req.body as {
      name?: string;
      icon_name?: string;
      description?: string;
      base_price_min?: number;
      base_price_max?: number;
    };

    if (!name || !icon_name) {
      fail(res, 'name and icon_name are required');
      return;
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO service_categories (id, name, icon_name, description, base_price_min, base_price_max)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, icon_name, description ?? null, base_price_min ?? null, base_price_max ?? null);

    ok(res, db.prepare('SELECT * FROM service_categories WHERE id = ?').get(id), 201);
  } catch (err) {
    console.error('[POST /categories]', err);
    fail(res, 'Could not create category', 500);
  }
});

// PATCH /api/categories/:id  (admin only)
router.patch('/:id', authenticate, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { name, icon_name, description, base_price_min, base_price_max, is_active } = req.body;

    db.prepare(`
      UPDATE service_categories SET
        name           = COALESCE(?, name),
        icon_name      = COALESCE(?, icon_name),
        description    = COALESCE(?, description),
        base_price_min = COALESCE(?, base_price_min),
        base_price_max = COALESCE(?, base_price_max),
        is_active      = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name ?? null, icon_name ?? null, description ?? null,
      base_price_min ?? null, base_price_max ?? null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      req.params.id
    );

    const category = db
      .prepare('SELECT * FROM service_categories WHERE id = ?')
      .get(req.params.id);

    if (!category) {
      fail(res, 'Category not found', 404);
      return;
    }
    ok(res, category);
  } catch (err) {
    console.error('[PATCH /categories/:id]', err);
    fail(res, 'Could not update category', 500);
  }
});

export default router;
