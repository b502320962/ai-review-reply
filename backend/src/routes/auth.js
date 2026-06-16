const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const db = require('../../config/database');
const { generateToken, authenticate } = require('../middleware/auth');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Google OAuth login
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ 
        success: false, 
        message: 'Google credential required' 
      });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?')
      .get(googleId, email);

    if (user) {
      // Update existing user
      db.prepare(`
        UPDATE users 
        SET name = ?, avatar = ?, google_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, picture, googleId, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    } else {
      // Create new user with free plan
      const result = db.prepare(`
        INSERT INTO users (email, name, avatar, google_id, plan, credits_total, credits_used)
        VALUES (?, ?, ?, ?, 'free', 30, 0)
      `).run(email, name, picture, googleId);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    // Generate JWT
    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          creditsTotal: user.credits_total,
          creditsUsed: user.credits_used,
          creditsRemaining: user.credits_total - user.credits_used
        }
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid Google credential' 
    });
  }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
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
      subscriptionEndDate: user.subscription_end_date
    }
  });
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
