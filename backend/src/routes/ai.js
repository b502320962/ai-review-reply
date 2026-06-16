const express = require('express');
const db = require('../../config/database');
const { authenticate, checkCredits } = require('../middleware/auth');

const router = express.Router();

// Tone configurations
const TONE_PROMPTS = {
  professional: 'Write a professional and business-like reply. Be courteous, formal, and solution-oriented.',
  friendly: 'Write a warm and friendly reply. Be approachable, positive, and conversational.',
  apologetic: 'Write an apologetic and understanding reply. Acknowledge the issue, show empathy, and offer solutions.',
  grateful: 'Write a grateful and appreciative reply. Thank the customer sincerely and express genuine appreciation.'
};

// Platform-specific instructions
const PLATFORM_PROMPTS = {
  google: 'Format for Google Business reply. Keep it concise (under 300 words), professional, and mention the business name if available.',
  yelp: 'Format for Yelp business reply. Be personable, address specific points from the review, and maintain a helpful tone.'
};

// Generate AI reply
router.post('/generate', authenticate, checkCredits, async (req, res) => {
  try {
    const { review, tone = 'professional', platform = 'google' } = req.body;
    const user = req.user;

    if (!review) {
      return res.status(400).json({
        success: false,
        message: 'Review text is required'
      });
    }

    // Get AI configuration
    const aiConfig = db.prepare('SELECT * FROM ai_configs WHERE is_default = 1').get();
    
    if (!aiConfig || !aiConfig.api_key) {
      return res.status(500).json({
        success: false,
        message: 'AI service not configured'
      });
    }

    // Check if platform is enabled
    const platformConfig = db.prepare('SELECT * FROM platform_configs WHERE platform = ? AND enabled = 1')
      .get(platform);
    
    if (!platformConfig) {
      return res.status(400).json({
        success: false,
        message: `Platform ${platform} is not enabled`
      });
    }

    // Build prompt
    const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.professional;
    const platformPrompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.google;

    const systemPrompt = `You are an AI assistant helping businesses reply to customer reviews. 
Your task is to generate a professional, helpful reply to the given review.

Guidelines:
${tonePrompt}
${platformPrompt}
- Address specific points mentioned in the review
- Be authentic and genuine
- Keep the reply appropriate for the platform
- Do not use placeholder text like [Business Name]
- Return ONLY the reply text, no explanations`;

    const userPrompt = `Please generate a reply to this customer review:

"${review}"

Generate a reply that addresses the customer's feedback appropriately.`;

    // Call AI API
    const response = await fetch(aiConfig.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.api_key}`
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'AI API request failed');
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error('No reply generated');
    }

    // Deduct credit
    db.prepare('UPDATE users SET credits_used = credits_used + 1 WHERE id = ?')
      .run(user.id);

    // Log usage
    db.prepare(`
      INSERT INTO usage_logs (user_id, platform, tone, review_text, reply_text, tokens_used)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, platform, tone, review, reply, data.usage?.total_tokens || 0);

    // Get updated user credits
    const updatedUser = db.prepare('SELECT credits_total, credits_used FROM users WHERE id = ?')
      .get(user.id);

    res.json({
      success: true,
      data: {
        reply,
        creditsRemaining: updatedUser.credits_total - updatedUser.credits_used
      }
    });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate reply'
    });
  }
});

// Get supported platforms
router.get('/platforms', (req, res) => {
  const platforms = db.prepare('SELECT platform, enabled FROM platform_configs').all();
  res.json({
    success: true,
    data: platforms
  });
});

module.exports = router;
