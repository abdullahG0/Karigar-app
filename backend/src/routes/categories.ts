import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();

// GET /api/categories
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM service_categories WHERE is_active = true ORDER BY name'
    );
    ok(res, rows);
  } catch (err) {
    console.error('[GET /categories]', err);
    fail(res, 'Could not fetch categories', 500);
  }
});

// GET /api/categories/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM service_categories WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) {
      fail(res, 'Category not found', 404);
      return;
    }
    ok(res, rows[0]);
  } catch (err) {
    console.error('[GET /categories/:id]', err);
    fail(res, 'Could not fetch category', 500);
  }
});

// POST /api/categories  (admin only)
router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
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
    await db.query(`
      INSERT INTO service_categories (id, name, icon_name, description, base_price_min, base_price_max)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [id, name, icon_name, description ?? null, base_price_min ?? null, base_price_max ?? null]);

    const { rows } = await db.query('SELECT * FROM service_categories WHERE id = $1', [id]);
    ok(res, rows[0], 201);
  } catch (err) {
    console.error('[POST /categories]', err);
    fail(res, 'Could not create category', 500);
  }
});

// PATCH /api/categories/:id  (admin only)
router.patch('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, icon_name, description, base_price_min, base_price_max, is_active } = req.body;

    await db.query(`
      UPDATE service_categories SET
        name           = COALESCE($1, name),
        icon_name      = COALESCE($2, icon_name),
        description    = COALESCE($3, description),
        base_price_min = COALESCE($4, base_price_min),
        base_price_max = COALESCE($5, base_price_max),
        is_active      = COALESCE($6, is_active)
      WHERE id = $7
    `, [
      name ?? null, icon_name ?? null, description ?? null,
      base_price_min ?? null, base_price_max ?? null,
      is_active !== undefined ? Boolean(is_active) : null,
      req.params.id,
    ]);

    const { rows } = await db.query('SELECT * FROM service_categories WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      fail(res, 'Category not found', 404);
      return;
    }
    ok(res, rows[0]);
  } catch (err) {
    console.error('[PATCH /categories/:id]', err);
    fail(res, 'Could not update category', 500);
  }
});

export default router;
