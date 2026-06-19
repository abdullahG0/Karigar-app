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
router.post('/login', (req: Request, res: Response): void => {
  try {
    const { phone, password } = req.body as { phone?: string; password?: string };
    if (!phone || !password) {
      fail(res, 'phone and password are required');
      return;
    }

    const user = db
      .prepare('SELECT * FROM users WHERE phone = ?')
      .get(phone) as Record<string, unknown> | undefined;

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
router.post('/register', (req: Request, res: Response): void => {
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
    if (name.trim().length > 100) { fail(res, 'name must be 100 characters or fewer'); return; }
    if (phone.trim().length > 20)  { fail(res, 'phone must be 20 characters or fewer'); return; }

    if (society_id) {
      const soc = db
        .prepare('SELECT id FROM societies WHERE id = ? AND is_active = 1')
        .get(society_id);
      if (!soc) {
        fail(res, `Society '${society_id}' not found`);
        return;
      }
    }

    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing) {
      fail(res, 'Phone number is already registered', 409);
      return;
    }

    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);

    db.prepare(
      'INSERT INTO users (id, name, phone, password_hash, role, society_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, phone, password_hash, role, society_id ?? null);

    if (role === 'professional') {
      db.prepare('INSERT INTO professionals (id, user_id) VALUES (?, ?)').run(uuidv4(), id);
    }

    const token = jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '7d' });
    ok(res, { token, user: { id, name, phone, role, society_id: society_id ?? null } }, 201);
  } catch (err) {
    console.error('[POST /auth/register]', err);
    fail(res, 'Registration failed due to a server error', 500);
  }
});

// GET /api/auth/me  (authenticated)
router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user!.id;

    const user = db
      .prepare('SELECT id, name, phone, role, society_id, created_at FROM users WHERE id = ?')
      .get(userId) as Record<string, unknown> | undefined;

    if (!user) {
      fail(res, 'User not found', 404);
      return;
    }

    let professional: Record<string, unknown> | null = null;
    if (user.role === 'professional') {
      professional = db
        .prepare(`
          SELECT p.*,
            COALESCE(
              json_group_array(
                json_object('id', sc.id, 'name', sc.name, 'icon_name', sc.icon_name)
              ) FILTER (WHERE sc.id IS NOT NULL),
              '[]'
            ) AS categories
          FROM professionals p
          LEFT JOIN professional_categories pc ON pc.professional_id = p.id
          LEFT JOIN service_categories sc ON sc.id = pc.category_id
          WHERE p.user_id = ?
          GROUP BY p.id
        `)
        .get(userId) as Record<string, unknown> | null;

      if (professional) {
        professional = {
          ...professional,
          categories:   JSON.parse(professional.categories as string),
          is_verified:  Boolean(professional.is_verified),
          is_available: Boolean(professional.is_available),
        };
      }
    }

    ok(res, { ...user, professional });
  } catch (err) {
    console.error('[GET /auth/me]', err);
    fail(res, 'Could not fetch profile', 500);
  }
});

// GET /api/auth/societies  (public — needed by registration screen)
router.get('/societies', (_req: Request, res: Response): void => {
  try {
    const rows = db
      .prepare('SELECT id, name, city FROM societies WHERE is_active = 1 ORDER BY name')
      .all();
    ok(res, rows);
  } catch (err) {
    console.error('[GET /auth/societies]', err);
    fail(res, 'Could not fetch societies', 500);
  }
});

// GET /api/auth/users  (admin only — list all users)
router.get('/users', authenticate, (req: AuthRequest, res: Response): void => {
  try {
    if (req.user!.role !== 'admin') {
      fail(res, 'Forbidden', 403);
      return;
    }
    const users = db
      .prepare('SELECT id, name, phone, role, society_id, created_at FROM users ORDER BY created_at DESC')
      .all();
    ok(res, users);
  } catch (err) {
    console.error('[GET /auth/users]', err);
    fail(res, 'Could not fetch users', 500);
  }
});

export default router;
