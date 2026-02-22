import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// All project routes require authentication
router.use(authenticateToken);

// List Projects
router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const stmt = db.prepare('SELECT id, name, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC');
    const projects = stmt.all(userId);
    res.json(projects);
  } catch (error) {
    console.error('List Projects Error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Create Project
router.post('/', (req: AuthRequest, res) => {
  const { name, data } = req.body;
  const userId = req.user!.id;

  if (!name) {
    return res.status(400).json({ error: 'Project name required' });
  }

  try {
    const id = uuidv4();
    const projectData = data ? JSON.stringify(data) : JSON.stringify({});

    const stmt = db.prepare('INSERT INTO projects (id, user_id, name, data) VALUES (?, ?, ?, ?)');
    stmt.run(id, userId, name, projectData);

    res.status(201).json({ id, name, updated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Create Project Error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get Project
router.get('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?');
    const project = stmt.get(id, userId) as any;

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Parse the JSON data string back to an object
    project.data = JSON.parse(project.data);
    res.json(project);
  } catch (error) {
    console.error('Get Project Error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Update Project
router.put('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { name, data } = req.body;

  try {
    // Check if project exists and belongs to user
    const checkStmt = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?');
    const existing = checkStmt.get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Build update query dynamically based on what's provided
    const updates: string[] = [];
    const values: any[] = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (data) {
      updates.push('data = ?');
      values.push(JSON.stringify(data)); // Store as JSON string in DB
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id); // For WHERE clause
      values.push(userId); // For WHERE clause

      const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
      const updateStmt = db.prepare(sql);
      updateStmt.run(...values);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update Project Error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete Project
router.delete('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const stmt = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete Project Error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
