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

router.get('/:id/usage', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('SELECT data FROM projects WHERE user_id = ?');
    const projects = stmt.all(id) as any[];

    let totalNodes = 0;
    let totalEdges = 0;

    projects.forEach(project => {
      try {
        const data = JSON.parse(project.data || '{}');
        totalNodes += (data.nodes || []).length;
        totalEdges += (data.edges || []).length;
      } catch (e) {
        console.error('Failed to parse project data for usage stats', e);
      }
    });
    
    // Count total messages directly from the database using SQL
    const messagesCountStmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)');
    const messagesCountResult = messagesCountStmt.get(id) as { count: number };
    const totalMessages = messagesCountResult.count;

    res.json({
      projectCount: projects.length,
      totalNodes,
      totalEdges,
      totalMessages
    });

  } catch (error) {
    console.error('Fetch User Usage Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
