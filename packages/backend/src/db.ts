import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'tapestry.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: Database.Database = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize Schema
const initSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data JSON NOT NULL, -- The entire project state: nodes, edges, messages, etc.
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
  `);

  // Simple migration for existing DB
  try {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;');
    console.log('Migrated users table to include is_admin column.');
  } catch (err: any) {
    // If it throws, it means the column already exists, which is fine!
  }

  // Migrate messages out of `projects.data` JSON into the `messages` table
  const messagesTableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='messages'").get() as { count: number };
  if (messagesTableCheck.count > 0) {
    const projectsWithMessages = db.prepare(`SELECT id, data FROM projects WHERE json_extract(data, '$.messages') IS NOT NULL`).all() as any[];
    if (projectsWithMessages.length > 0) {
      console.log(`Migrating messages for ${projectsWithMessages.length} projects...`);
      const insertMessageStmt = db.prepare('INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)');
      const updateProjectStmt = db.prepare('UPDATE projects SET data = ? WHERE id = ?');
      
      db.transaction(() => {
        for (const project of projectsWithMessages) {
          try {
            const data = JSON.parse(project.data);
            if (data.messages && Array.isArray(data.messages)) {
              for (const msg of data.messages) {
                // Determine a timestamp (use current time if missing or invalid to avoid db errors)
                const timestampStr = msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString();
                insertMessageStmt.run(uuidv4(), project.id, msg.role || 'user', msg.content || '', timestampStr);
              }
              // Remove messages from the JSON blob
              delete data.messages;
              updateProjectStmt.run(JSON.stringify(data), project.id);
            }
          } catch (e) {
            console.error(`Error migrating messages for project ${project.id}`, e);
          }
        }
      })();
      console.log(`Migrated messages out of JSON blobs.`);
    }
  }

  // Seed default admin account
  const adminCheck = db.prepare('SELECT count(*) as count FROM users WHERE is_admin = 1').get() as { count: number };
  if (adminCheck.count === 0) {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(adminPassword, 10);
    try {
      db.prepare('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 1)').run(uuidv4(), adminUsername, hash);
      console.log(`Seeded default admin account: ${adminUsername}`);
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
         // Existing user named 'admin', so we'll just promote them and update password
         db.prepare('UPDATE users SET is_admin = 1, password_hash = ? WHERE username = ?').run(hash, adminUsername);
         console.log(`Promoted existing user '${adminUsername}' to admin.`);
      }
    }
  }
};

initSchema();

export default db;
