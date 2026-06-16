const jwt = require('jsonwebtoken');
const db = require('../../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      plan: user.plan 
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Verify JWT token middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
}

// Check if user has credits
function checkCredits(req, res, next) {
  const user = req.user;
  const creditsRemaining = user.credits_total - user.credits_used;
  
  if (creditsRemaining <= 0) {
    return res.status(403).json({
      success: false,
      message: 'No credits remaining. Please upgrade to Pro.',
      code: 'NO_CREDITS'
    });
  }
  
  next();
}

// Check if user is Pro
function requirePro(req, res, next) {
  if (req.user.plan !== 'pro') {
    return res.status(403).json({
      success: false,
      message: 'Pro subscription required',
      code: 'PRO_REQUIRED'
    });
  }
  next();
}

module.exports = { generateToken, authenticate, checkCredits, requirePro };
