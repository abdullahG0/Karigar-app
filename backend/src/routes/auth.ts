import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../middleware/respond';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body as { phone?: string; password?: string };
    if (!phone || !password) {
      fail(res, 'phone and password are required');
      return;
    }

    const { rows } = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    const user = rows[0] as Record<string, unknown> | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash as string)) {
      fail(res, 'Invalid phone number or password', 401);
      return;
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _omit, ...safeUser } = user;
    ok(res, { token, user: safeUser });
  } catch (err) {
    console.error('[POST /auth/login]', err);
    fail(res, 'Login failed due to a server error', 500);
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, password, role, society_id } = req.body as {
      name?: string;
      phone?: string;
      password?: string;
      role?: string;
      society_id?: string;
    };

    if (!name || !phone || !password || !role) {
      fail(res, 'name, phone, password, and role are required');
      return;
    }
    if (!['resident', 'professional'].includes(role)) {
      fail(res, 'role must be resident or professional');
      return;
    }
    if (password.length < 6) {
      fail(res, 'password must be at least 6 characters');
      return;
    }
    if (name.trim().length > 100)  { fail(res, 'name must be 100 characters or fewer'); return; }
    if (phone.trim().length > 20)  { fail(res, 'phone must be 20 characters or fewer'); return; }

    if (society_id) {
      const { rows: socRows } = await db.query(
        'SELECT id FROM societies WHERE id = $1 AND is_active = true',
        [society_id]
      );
      if (socRows.length === 0) {
        fail(res, `Society '${society_id}' not found`);
        return;
      }
    }

    const { rows: existing } = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.length > 0) {
      fail(res, 'Phone number is already registered', 409);
      return;
    }

    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);

    await db.query(
      'INSERT INTO users (id, name, phone, password_hash, role, society_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, name, phone, password_hash, role, society_id ?? null]
    );

    if (role === 'professional') {
      await db.query('INSERT INTO professionals (id, user_id) VALUES ($1,$2)', [uuidv4(), id]);
    }

    const token = jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '7d' });
    ok(res, { token, user: { id, name, phone, role, society_id: society_id ?? null } }, 201);
  } catch (err) {
    console.error('[POST /auth/register]', err);
    fail(res, 'Registration failed due to a server error', 500);
  }
});

// GET /api/auth/me  (authenticated)
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const { rows: userRows } = await db.query(
      'SELECT id, name, phone, role, society_id, created_at FROM users WHERE id = $1',
      [userId]
    );
    const user = userRows[0] as Record<string, unknown> | undefined;

    if (!user) {
      fail(res, 'User not found', 404);
      return;
    }

    let professional: Record<string, unknown> | null = null;
    if (user.role === 'professional') {
      const { rows: proRows } = await db.query(`
        SELECT p.*,
          COALESCE(
            json_agg(
              json_build_object('id', sc.id, 'name', sc.name, 'icon_name', sc.icon_name)
            ) FILTER (WHERE sc.id IS NOT NULL),
            '[]'::json
          ) AS categories
        FROM professionals p
        LEFT JOIN professional_categories pc ON pc.professional_id = p.id
        LEFT JOIN service_categories sc ON sc.id = pc.category_id
        WHERE p.user_id = $1
        GROUP BY p.id
      `, [userId]);
      professional = proRows[0] ?? null;
    }

    ok(res, { ...user, professional });
  } catch (err) {
    console.error('[GET /auth/me]', err);
    fail(res, 'Could not fetch profile', 500);
  }
});

// GET /api/auth/societies  (public — needed by registration screen)
router.get('/societies', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, city FROM societies WHERE is_active = true ORDER BY name'
    );
    ok(res, rows);
  } catch (err) {
    console.error('[GET /auth/societies]', err);
    fail(res, 'Could not fetch societies', 500);
  }
});

// GET /api/auth/users  (admin only — list all users)
router.get('/users', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'admin') {
      fail(res, 'Forbidden', 403);
      return;
    }
    const { rows } = await db.query(
      'SELECT id, name, phone, role, society_id, created_at FROM users ORDER BY created_at DESC'
    );
    ok(res, rows);
  } catch (err) {
    console.error('[GET /auth/users]', err);
    fail(res, 'Could not fetch users', 500);
  }
});

export default router;
