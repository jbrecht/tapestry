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
    let projectMessages: any[] = [];
    
    // Extract messages if present
    if (data && data.messages) {
      projectMessages = data.messages;
      delete data.messages;
    }
    
    const projectData = data ? JSON.stringify(data) : JSON.stringify({});

    const stmt = db.prepare('INSERT INTO projects (id, user_id, name, data) VALUES (?, ?, ?, ?)');
    stmt.run(id, userId, name, projectData);
    
    // Insert messages
    if (projectMessages.length > 0) {
      const insertMessageStmt = db.prepare('INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)');
      db.transaction(() => {
        for (const msg of projectMessages) {
          const timestampStr = msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString();
          insertMessageStmt.run(uuidv4(), id, msg.role || 'user', msg.content || '', timestampStr);
        }
      })();
    }

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
    
    // Fetch messages for this project
    const messagesStmt = db.prepare('SELECT role, content, created_at as timestamp FROM messages WHERE project_id = ? ORDER BY created_at ASC');
    const messages = messagesStmt.all(id) as any[];
    
    // Reattach messages to the data payload for the frontend
    project.data.messages = messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp).getTime() // Convert ISO string back to JS timestamp
    }));

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
      let projectMessages: any[] | null = null;
      if (data.messages) {
        projectMessages = data.messages;
        delete data.messages;
      }
      
      updates.push('data = ?');
      values.push(JSON.stringify(data)); // Store as JSON string in DB
      
      // Update messages if they were provided
      if (projectMessages !== null) {
        db.transaction(() => {
          // Simplest sync: Delete all and re-insert 
          const deleteMessagesStmt = db.prepare('DELETE FROM messages WHERE project_id = ?');
          deleteMessagesStmt.run(id);
          
          if (projectMessages.length > 0) {
            const insertMessageStmt = db.prepare('INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)');
            for (const msg of projectMessages) {
              const timestampStr = msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString();
              insertMessageStmt.run(uuidv4(), id, msg.role || 'user', msg.content || '', timestampStr);
            }
          }
        })();
      }
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
