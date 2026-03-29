import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { JWT_SECRET } from '../config.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 30;

interface UserRow {
  id: string;
  username: string;
  is_admin: number;
  password_hash: string;
}

function issueTokens(userId: string, username: string, isAdmin: boolean): { token: string; refreshToken: string } {
  const payload = { id: userId, username, isAdmin };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(refreshToken, userId, expiresAt);

  return { token, refreshToken };
}

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId, username, hashedPassword);

    const { token, refreshToken } = issueTokens(userId, username, false);
    const user = { id: userId, username, isAdmin: false };
    res.status(201).json({ token, refreshToken, user });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { token, refreshToken } = issueTokens(user.id, user.username, !!user.is_admin);
    res.json({ token, refreshToken, user: { id: user.id, username: user.username, isAdmin: !!user.is_admin } });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  const row = db.prepare(`
    SELECT rt.token, rt.user_id, rt.expires_at, u.username, u.is_admin
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token = ?
  `).get(refreshToken) as { token: string; user_id: string; expires_at: string; username: string; is_admin: number } | undefined;

  if (!row || new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Rotate: delete old token, issue new pair
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  const { token, refreshToken: newRefreshToken } = issueTokens(row.user_id, row.username, !!row.is_admin);
  res.json({ token, refreshToken: newRefreshToken, user: { id: row.user_id, username: row.username, isAdmin: !!row.is_admin } });
});

// Logout
router.post('/logout', authenticateToken, (req: AuthRequest, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }
  res.json({ message: 'Logged out' });
});

export default router;
