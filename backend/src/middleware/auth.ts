import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const _secret = process.env.JWT_SECRET;
if (!_secret) throw new Error('JWT_SECRET environment variable is required');
const JWT_SECRET: string = _secret;

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization token' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as unknown as { id: string; role: string };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token is invalid or has expired' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Forbidden — insufficient permissions' });
      return;
    }
    next();
  };
}
