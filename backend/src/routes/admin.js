const express = require('express');
const db = require('../../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Simple admin check (in production, use proper role-based auth)
function requireAdmin(req, res, next) {
  // For now, check if user email is in admin list
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);
  
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
}

// Get all AI configurations
router.get('/ai-configs', authenticate, requireAdmin, (req, res) => {
  const configs = db.prepare('SELECT * FROM ai_configs ORDER BY is_default DESC').all();
  res.json({
    success: true,
    data: configs
  });
});

// Add or update AI configuration
router.post('/ai-configs', authenticate, requireAdmin, (req, res) => {
  try {
    const { provider, model, apiKey, apiUrl, isDefault } = req.body;

    if (!provider || !model || !apiKey || !apiUrl) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // If setting as default, unset others
    if (isDefault) {
      db.prepare('UPDATE ai_configs SET is_default = 0').run();
    }

    const existing = db.prepare('SELECT id FROM ai_configs WHERE provider = ? AND model = ?')
      .get(provider, model);

    if (existing) {
      db.prepare(`
        UPDATE ai_configs 
        SET api_key = ?, api_url = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(apiKey, apiUrl, isDefault ? 1 : 0, existing.id);
    } else {
      db.prepare(`
        INSERT INTO ai_configs (provider, model, api_key, api_url, is_default)
        VALUES (?, ?, ?, ?, ?)
      `).run(provider, model, apiKey, apiUrl, isDefault ? 1 : 0);
    }

    res.json({ success: true, message: 'AI configuration saved' });
  } catch (error) {
    console.error('AI config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save AI configuration'
    });
  }
});

// Delete AI configuration
router.delete('/ai-configs/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM ai_configs WHERE id = ?').run(id);
  res.json({ success: true, message: 'AI configuration deleted' });
});

// Get platform configurations
router.get('/platform-configs', authenticate, requireAdmin, (req, res) => {
  const configs = db.prepare('SELECT * FROM platform_configs').all();
  res.json({
    success: true,
    data: configs
  });
});

// Update platform configuration
router.put('/platform-configs/:platform', authenticate, requireAdmin, (req, res) => {
  const { platform } = req.params;
  const { enabled, settings } = req.body;

  db.prepare(`
    UPDATE platform_configs 
    SET enabled = ?, settings = ?, updated_at = CURRENT_TIMESTAMP
    WHERE platform = ?
  `).run(enabled ? 1 : 0, JSON.stringify(settings || {}), platform);

  res.json({ success: true, message: 'Platform configuration updated' });
});

// Get all users (admin only)
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const users = db.prepare(`
    SELECT id, email, name, plan, credits_total, credits_used, 
           subscription_status, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset));

  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get usage statistics (admin only)
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE plan = 'pro') as pro_users,
      (SELECT COUNT(*) FROM users WHERE DATE(created_at) = DATE('now')) as new_users_today,
      (SELECT COUNT(*) FROM usage_logs) as total_generations,
      (SELECT COUNT(*) FROM usage_logs WHERE DATE(created_at) = DATE('now')) as generations_today,
      (SELECT COUNT(*) FROM usage_logs WHERE created_at >= DATE('now', '-7 days')) as generations_week
  `).get();

  res.json({
    success: true,
    data: stats
  });
});

module.exports = router;
