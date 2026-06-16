const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    google_id TEXT UNIQUE,
    plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro')),
    credits_total INTEGER DEFAULT 30,
    credits_used INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'none',
    subscription_end_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    tone TEXT,
    review_text TEXT,
    reply_text TEXT,
    tokens_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ai_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    api_key TEXT NOT NULL,
    api_url TEXT NOT NULL,
    is_default BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS platform_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    settings TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
`);

// Insert default AI configurations if not exists
const aiConfigCount = db.prepare('SELECT COUNT(*) as count FROM ai_configs').get();
if (aiConfigCount.count === 0) {
  db.prepare(`
    INSERT INTO ai_configs (provider, model, api_key, api_url, is_default) 
    VALUES (?, ?, ?, ?, ?)
  `).run('deepseek', 'deepseek-chat', '', 'https://api.deepseek.com/v1/chat/completions', 1);
}

// Insert default platform configurations if not exists
const platformConfigCount = db.prepare('SELECT COUNT(*) as count FROM platform_configs').get();
if (platformConfigCount.count === 0) {
  db.prepare('INSERT INTO platform_configs (platform, enabled, settings) VALUES (?, ?, ?)').run('google', 1, '{}');
  db.prepare('INSERT INTO platform_configs (platform, enabled, settings) VALUES (?, ?, ?)').run('yelp', 1, '{}');
}

module.exports = db;
