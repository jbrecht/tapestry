import express from 'express';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC');
    const users = stmt.all() as any[];
    
    const formattedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      isAdmin: !!u.is_admin,
      createdAt: u.created_at
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Fetch Users Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
