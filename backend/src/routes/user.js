const express = require('express');
const db = require('../../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', authenticate, (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      plan: user.plan,
      creditsTotal: user.credits_total,
      creditsUsed: user.credits_used,
      creditsRemaining: user.credits_total - user.credits_used,
      subscriptionStatus: user.subscription_status,
      subscriptionEndDate: user.subscription_end_date,
      createdAt: user.created_at
    }
  });
});

// Get usage history
router.get('/usage', authenticate, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const userId = req.user.id;

  const logs = db.prepare(`
    SELECT id, platform, tone, review_text, reply_text, tokens_used, created_at
    FROM usage_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, parseInt(limit), parseInt(offset));

  const total = db.prepare('SELECT COUNT(*) as count FROM usage_logs WHERE user_id = ?')
    .get(userId).count;

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get usage statistics
router.get('/stats', authenticate, (req, res) => {
  const userId = req.user.id;

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_generations,
      SUM(tokens_used) as total_tokens,
      COUNT(CASE WHEN platform = 'google' THEN 1 END) as google_count,
      COUNT(CASE WHEN platform = 'yelp' THEN 1 END) as yelp_count,
      COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as today_count,
      COUNT(CASE WHEN created_at >= DATE('now', '-7 days') THEN 1 END) as week_count
    FROM usage_logs
    WHERE user_id = ?
  `).get(userId);

  res.json({
    success: true,
    data: stats
  });
});

module.exports = router;
