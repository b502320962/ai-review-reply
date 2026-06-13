// AI Review Reply - Background Service Worker

const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_API_KEY = ''; // Users will set their own key

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

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateReply') {
    handleGenerateReply(request)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'openPopup') {
    chrome.action.openPopup();
  }
});

// Generate reply using AI
async function handleGenerateReply({ review, tone, platform }) {
  // Get API key from storage
  const { apiKey } = await chrome.storage.local.get('apiKey');
  
  if (!apiKey) {
    throw new Error('Please set your API key in the extension settings.');
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

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
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
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error('No reply generated');
    }

    return { reply };
  } catch (error) {
    console.error('AI generation error:', error);
    throw error;
  }
}

// Install handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default credits
    chrome.storage.local.set({ credits: 200 });
    
    // Open options page
    chrome.runtime.openOptionsPage();
  }
});
