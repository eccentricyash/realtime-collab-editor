import { Router, Request, Response } from 'express';
import prisma from '../db/prismaClient';
import { authService, JwtPayload } from '../services/authService';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F97316', '#14B8A6', '#6366F1', '#D946EF', '#06B6D4', '#84CC16',
];

function getUserColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash += username.charCodeAt(i);
  }
  return COLORS[hash % COLORS.length];
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body as {
      email?: string;
      username?: string;
      password?: string;
    };

    if (!email || !username || !password) {
      res.status(400).json({ error: 'Email, username, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    if (username.length < 2 || username.length > 30) {
      res.status(400).json({ error: 'Username must be 2-30 characters' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Check existing user
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      res.status(409).json({ error: `${field} already taken` });
      return;
    }

    const passwordHash = await authService.hashPassword(password);
    const color = getUserColor(username);

    const user = await prisma.user.create({
      data: { email, username, passwordHash, color },
    });

    const payload: JwtPayload = { userId: user.id, email: user.email, username: user.username };
    const accessToken = authService.generateAccessToken(payload);
    const refreshToken = authService.generateRefreshToken(payload);

    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      user: { id: user.id, email: user.email, username: user.username, color: user.color },
      accessToken,
    });
  } catch (error) {
    console.error('[Auth] Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await authService.comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const payload: JwtPayload = { userId: user.id, email: user.email, username: user.username };
    const accessToken = authService.generateAccessToken(payload);
    const refreshToken = authService.generateRefreshToken(payload);

    setRefreshCookie(res, refreshToken);

    res.json({
      user: { id: user.id, email: user.email, username: user.username, color: user.color },
      accessToken,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    const payload = authService.verifyRefreshToken(token);

    // Verify user still exists
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const newPayload: JwtPayload = { userId: user.id, email: user.email, username: user.username };
    const accessToken = authService.generateAccessToken(newPayload);
    const refreshToken = authService.generateRefreshToken(newPayload);

    setRefreshCookie(res, refreshToken);

    res.json({ accessToken, user: { id: user.id, email: user.email, username: user.username, color: user.color } });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ id: user.id, email: user.email, username: user.username, color: user.color });
  } catch (error) {
    console.error('[Auth] Me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;
