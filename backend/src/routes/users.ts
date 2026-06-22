import { Router, Response } from 'express';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
router.use(authenticate);

// PATCH /api/users/me  — update the caller's own display name
// Must be registered BEFORE /:id so '/me' isn't captured as a param.
router.patch('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body as { name?: string };

    if (!name || name.trim().length === 0) {
      fail(res, 'name is required');
      return;
    }

    const result = await db.query(
      'UPDATE users SET name = $1 WHERE id = $2',
      [name.trim(), req.user!.id]
    );

    if (result.rowCount === 0) {
      fail(res, 'User not found', 404);
      return;
    }

    const { rows } = await db.query(
      'SELECT id, name, phone, role, society_id, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    ok(res, rows[0]);
  } catch (err) {
    console.error('[PATCH /users/me]', err);
    fail(res, 'Could not update user', 500);
  }
});

// GET /api/users/:id  — public profile of any user (authenticated callers only)
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: userRows } = await db.query(
      'SELECT id, name, phone, role, society_id, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    const user = userRows[0] as Record<string, unknown> | undefined;

    if (!user) {
      fail(res, 'User not found', 404);
      return;
    }

    let professional: Record<string, unknown> | null = null;
    if (user.role === 'professional') {
      const { rows: proRows } = await db.query(
        'SELECT id, bio, hourly_rate, is_verified, is_available, rating, total_jobs FROM professionals WHERE user_id = $1',
        [user.id as string]
      );
      professional = proRows[0] ?? null;
    }

    ok(res, { ...user, professional });
  } catch (err) {
    console.error('[GET /users/:id]', err);
    fail(res, 'Could not fetch user', 500);
  }
});

export default router;
