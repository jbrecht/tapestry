import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const stmt = db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)');
    stmt.run(userId, username, hashedPassword);

    const payload = { id: userId, username, isAdmin: false };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, user: payload });
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
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = { id: user.id, username: user.username, isAdmin: !!user.is_admin };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: payload });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
