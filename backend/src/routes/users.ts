import { Router, Response } from 'express';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
router.use(authenticate);

// GET /api/users/:id  — public profile of any user (authenticated callers only)
router.get('/:id', (req: AuthRequest, res: Response): void => {
  try {
    const user = db
      .prepare(
        'SELECT id, name, phone, role, society_id, created_at FROM users WHERE id = ?'
      )
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!user) {
      fail(res, 'User not found', 404);
      return;
    }

    // If the user is a professional, attach their public profile.
    let professional: Record<string, unknown> | null = null;
    if (user.role === 'professional') {
      professional = db
        .prepare('SELECT id, bio, hourly_rate, is_verified, is_available, rating, total_jobs FROM professionals WHERE user_id = ?')
        .get(user.id as string) as Record<string, unknown> | null;

      if (professional) {
        professional = {
          ...professional,
          is_verified:  Boolean(professional.is_verified),
          is_available: Boolean(professional.is_available),
        };
      }
    }

    ok(res, { ...user, professional });
  } catch (err) {
    console.error('[GET /users/:id]', err);
    fail(res, 'Could not fetch user', 500);
  }
});

// PATCH /api/users/me  — update the caller's own display name
// Must be registered BEFORE /:id so '/me' isn't captured as a param.
router.patch('/me', (req: AuthRequest, res: Response): void => {
  try {
    const { name } = req.body as { name?: string };

    if (!name || name.trim().length === 0) {
      fail(res, 'name is required');
      return;
    }

    const { changes } = db
      .prepare('UPDATE users SET name = ? WHERE id = ?')
      .run(name.trim(), req.user!.id);

    if (changes === 0) {
      fail(res, 'User not found', 404);
      return;
    }

    const updated = db
      .prepare('SELECT id, name, phone, role, society_id, created_at FROM users WHERE id = ?')
      .get(req.user!.id);

    ok(res, updated);
  } catch (err) {
    console.error('[PATCH /users/me]', err);
    fail(res, 'Could not update user', 500);
  }
});

export default router;
