const express = require('express');
const db = require('../../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let stripe;
if (STRIPE_SECRET_KEY) {
  stripe = require('stripe')(STRIPE_SECRET_KEY);
}

// Create checkout session
router.post('/create-checkout', authenticate, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Stripe not configured'
      });
    }

    const user = req.user;

    // Create or get Stripe customer
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id.toString() }
      });
      customerId = customer.id;
      
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
        .run(customerId, user.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: STRIPE_PRO_PRICE_ID,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${req.headers.origin || 'chrome-extension://'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'chrome-extension://'}/cancel`,
      metadata: { userId: user.id.toString() }
    });

    res.json({
      success: true,
      data: { sessionId: session.id, url: session.url }
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
});

// Create portal session (manage subscription)
router.post('/create-portal', authenticate, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Stripe not configured'
      });
    }

    const user = req.user;
    
    if (!user.stripe_customer_id) {
      return res.status(400).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: req.headers.origin || 'chrome-extension://'
    });

    res.json({
      success: true,
      data: { url: session.url }
    });
  } catch (error) {
    console.error('Stripe portal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create portal session'
    });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ message: 'Webhook not configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // Handle events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        
        db.prepare(`
          UPDATE users 
          SET plan = 'pro', 
              credits_total = 300,
              stripe_subscription_id = ?,
              subscription_status = 'active',
              subscription_end_date = datetime('now', '+30 days'),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(session.subscription, userId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?')
          .get(customerId);
        
        if (user) {
          const status = subscription.status === 'active' ? 'active' : 'inactive';
          db.prepare(`
            UPDATE users 
            SET subscription_status = ?,
                subscription_end_date = datetime(?, 'unixepoch'),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(status, subscription.current_period_end, user.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?')
          .get(customerId);
        
        if (user) {
          db.prepare(`
            UPDATE users 
            SET plan = 'free',
                credits_total = 30,
                subscription_status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(user.id);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Get subscription status
router.get('/subscription', authenticate, (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    data: {
      plan: user.plan,
      subscriptionStatus: user.subscription_status,
      subscriptionEndDate: user.subscription_end_date,
      creditsTotal: user.credits_total,
      creditsUsed: user.credits_used,
      creditsRemaining: user.credits_total - user.credits_used
    }
  });
});

module.exports = router;
