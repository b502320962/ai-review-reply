// AI Review Reply - Popup Script

class ReviewReplyApp {
  constructor() {
    this.selectedTone = 'professional';
    this.selectedPlatform = 'google';
    this.credits = 200;
    this.init();
  }

  init() {
    this.loadState();
    this.bindEvents();
    this.updateUI();
  }

  // Load saved state from storage
  async loadState() {
    try {
      const result = await chrome.storage.local.get(['credits', 'selectedTone', 'selectedPlatform']);
      if (result.credits !== undefined) this.credits = result.credits;
      if (result.selectedTone) this.selectedTone = result.selectedTone;
      if (result.selectedPlatform) this.selectedPlatform = result.selectedPlatform;
      this.updateUI();
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }

  // Save state to storage
  async saveState() {
    try {
      await chrome.storage.local.set({
        credits: this.credits,
        selectedTone: this.selectedTone,
        selectedPlatform: this.selectedPlatform
      });
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  // Bind all event listeners
  bindEvents() {
    // Fetch review from page
    document.getElementById('fetch-review').addEventListener('click', () => this.fetchReview());

    // Generate reply
    document.getElementById('generate').addEventListener('click', () => this.generateReply());

    // Copy reply
    document.getElementById('copy-reply').addEventListener('click', () => this.copyReply());

    // Regenerate
    document.getElementById('regenerate').addEventListener('click', () => this.generateReply());

    // Use reply (insert to page)
    document.getElementById('use-reply').addEventListener('click', () => this.insertReply());

    // Tone buttons
    document.querySelectorAll('.tone-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectTone(btn));
    });

    // Platform buttons
    document.querySelectorAll('.platform-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectPlatform(btn));
    });

    // Settings
    document.getElementById('open-settings').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  // Update UI state
  updateUI() {
    document.getElementById('credit-count').textContent = this.credits;

    // Update tone buttons
    document.querySelectorAll('.tone-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tone === this.selectedTone);
    });

    // Update platform buttons
    document.querySelectorAll('.platform-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.platform === this.selectedPlatform);
    });
  }

  // Show status message
  showStatus(type, message) {
    const statusEl = document.getElementById('status');
    statusEl.className = `status ${type}`;
    statusEl.querySelector('.status-text').textContent = message;
    statusEl.classList.remove('hidden');
  }

  // Hide status
  hideStatus() {
    document.getElementById('status').classList.add('hidden');
  }

  // Select tone
  selectTone(btn) {
    this.selectedTone = btn.dataset.tone;
    this.saveState();
    this.updateUI();
  }

  // Select platform
  selectPlatform(btn) {
    this.selectedPlatform = btn.dataset.platform;
    this.saveState();
    this.updateUI();
  }

  // Fetch review from current page
  async fetchReview() {
    try {
      this.showStatus('loading', 'Getting review from page...');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getReview' });
      
      if (response && response.review) {
        document.getElementById('review-text').value = response.review;
        this.showStatus('success', 'Review captured successfully!');
        setTimeout(() => this.hideStatus(), 2000);
      } else {
        this.showStatus('error', 'No review found. Please navigate to a review page.');
        setTimeout(() => this.hideStatus(), 3000);
      }
    } catch (e) {
      this.showStatus('error', 'Failed to get review. Make sure you are on a supported page.');
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  // Generate AI reply
  async generateReply() {
    const reviewText = document.getElementById('review-text').value.trim();
    
    if (!reviewText) {
      this.showStatus('error', 'Please enter or fetch a review first.');
      setTimeout(() => this.hideStatus(), 3000);
      return;
    }

    if (this.credits <= 0) {
      this.showStatus('error', 'No credits remaining. Please upgrade your plan.');
      setTimeout(() => this.hideStatus(), 3000);
      return;
    }

    try {
      // Show loading
      const generateBtn = document.getElementById('generate');
      generateBtn.disabled = true;
      generateBtn.innerHTML = `
        <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Generating...
      `;
      this.showStatus('loading', 'AI is crafting your reply...');

      // Call background script to generate reply
      const response = await chrome.runtime.sendMessage({
        action: 'generateReply',
        review: reviewText,
        tone: this.selectedTone,
        platform: this.selectedPlatform
      });

      if (response && response.reply) {
        // Show result
        document.getElementById('reply-text').textContent = response.reply;
        document.getElementById('result').classList.remove('hidden');
        
        // Decrease credits
        this.credits--;
        this.saveState();
        this.updateUI();
        
        this.showStatus('success', 'Reply generated successfully!');
        setTimeout(() => this.hideStatus(), 2000);
      } else {
        throw new Error(response.error || 'Failed to generate reply');
      }
    } catch (e) {
      this.showStatus('error', e.message || 'Failed to generate reply. Please try again.');
      setTimeout(() => this.hideStatus(), 3000);
    } finally {
      const generateBtn = document.getElementById('generate');
      generateBtn.disabled = false;
      generateBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Generate AI Reply
      `;
    }
  }

  // Copy reply to clipboard
  async copyReply() {
    const replyText = document.getElementById('reply-text').textContent;
    
    try {
      await navigator.clipboard.writeText(replyText);
      this.showStatus('success', 'Copied to clipboard!');
      setTimeout(() => this.hideStatus(), 2000);
    } catch (e) {
      this.showStatus('error', 'Failed to copy. Please select and copy manually.');
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  // Insert reply to page
  async insertReply() {
    const replyText = document.getElementById('reply-text').textContent;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, {
        action: 'insertReply',
        reply: replyText
      });
      
      this.showStatus('success', 'Reply inserted to page!');
      setTimeout(() => this.hideStatus(), 2000);
    } catch (e) {
      this.showStatus('error', 'Failed to insert. Please copy and paste manually.');
      setTimeout(() => this.hideStatus(), 3000);
    }
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new ReviewReplyApp();
});
