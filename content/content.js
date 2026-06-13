// AI Review Reply - Content Script
// This script runs on Google Business and Yelp pages

class ContentScript {
  constructor() {
    this.platform = this.detectPlatform();
    this.init();
  }

  detectPlatform() {
    const url = window.location.href;
    if (url.includes('business.google.com')) return 'google';
    if (url.includes('yelp.com')) return 'yelp';
    return 'unknown';
  }

  init() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getReview') {
        const review = this.getSelectedReview();
        sendResponse({ review });
      } else if (request.action === 'insertReply') {
        this.insertReplyToPage(request.reply);
        sendResponse({ success: true });
      }
      return true;
    });

    // Add floating button
    this.addFloatingButton();
  }

  // Get review text from page
  getSelectedReview() {
    // Try to get selected text first
    const selection = window.getSelection().toString().trim();
    if (selection && selection.length > 20) {
      return selection;
    }

    // Otherwise try to find review based on platform
    if (this.platform === 'google') {
      return this.getGoogleReview();
    } else if (this.platform === 'yelp') {
      return this.getYelpReview();
    }

    return null;
  }

  // Get review from Google Business
  getGoogleReview() {
    // Google Business review selectors
    const selectors = [
      '.review-text',
      '[data-review-text]',
      '.ODSEW-ShBeI-text',
      '.review-content'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  // Get review from Yelp
  getYelpReview() {
    // Yelp review selectors
    const selectors = [
      '.review-content',
      '[data-review-content]',
      '.raw__09f24__T4Ezm'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  // Insert reply into reply textarea
  insertReplyToPage(reply) {
    if (this.platform === 'google') {
      this.insertToGoogle(reply);
    } else if (this.platform === 'yelp') {
      this.insertToYelp(reply);
    }
  }

  // Insert reply to Google Business
  insertToGoogle(reply) {
    const selectors = [
      'textarea[placeholder*="reply"]',
      'textarea[placeholder*="Reply"]',
      '.reply-textarea',
      '[data-reply-input]'
    ];

    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea) {
        textarea.value = reply;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    // Try to find any visible textarea
    const textareas = document.querySelectorAll('textarea');
    for (const textarea of textareas) {
      if (textarea.offsetParent !== null) {
        textarea.value = reply;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  // Insert reply to Yelp
  insertToYelp(reply) {
    const selectors = [
      'textarea[name*="reply"]',
      'textarea[placeholder*="reply"]',
      '.reply-textarea'
    ];

    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea) {
        textarea.value = reply;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  // Add floating action button
  addFloatingButton() {
    // Create button element
    const button = document.createElement('div');
    button.id = 'ai-reply-button';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    button.title = 'AI Reply';
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #ai-reply-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        background: #6366f1;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        z-index: 9999;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      #ai-reply-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
      }
      
      #ai-reply-button svg {
        width: 24px;
        height: 24px;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(button);

    // Add click handler
    button.addEventListener('click', () => {
      // Open popup programmatically
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
  }
}

// Initialize content script
new ContentScript();
