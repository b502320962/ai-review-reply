// AI Review Reply - Popup Script

class ReviewReplyApp {
  constructor() {
    this.selectedTone = 'professional';
    this.selectedPlatform = 'google';
    this.user = null;
    this.init();
  }

  async init() {
    await this.checkLoginState();
    this.bindEvents();
  }

  // Check if user is logged in
  async checkLoginState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getUserInfo' });
      
      if (response && response.success && response.user) {
        this.user = response.user;
        this.showMainSection();
      } else {
        this.showLoginSection();
      }
    } catch (error) {
      this.showLoginSection();
    }
  }

  // Show login section
  showLoginSection() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('main-section').classList.add('hidden');
    document.getElementById('user-badge').classList.add('hidden');
  }

  // Show main section
  showMainSection() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('main-section').classList.remove('hidden');
    document.getElementById('user-badge').classList.remove('hidden');
    
    this.updateUserUI();
    this.updateToneButtons();
    this.updatePlatformButtons();
  }

  // Update user UI
  updateUserUI() {
    if (!this.user) return;

    // Update user info
    const avatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const planBadge = document.getElementById('plan-badge');
    const creditsDisplay = document.getElementById('credits-display');
    const upgradeBanner = document.getElementById('upgrade-banner');

    avatar.src = this.user.avatar || '';
    userName.textContent = this.user.name || 'User';
    userEmail.textContent = this.user.email || '';
    
    // Update plan badge
    const isPro = this.user.plan === 'pro';
    planBadge.textContent = isPro ? 'PRO' : 'FREE';
    planBadge.className = `plan-badge ${isPro ? 'pro' : 'free'}`;
    
    // Update credits
    const remaining = this.user.creditsRemaining || 0;
    const total = this.user.creditsTotal || 30;
    creditsDisplay.textContent = `${remaining}/${total}`;
    
    // Show upgrade banner for free users
    if (!isPro) {
      upgradeBanner.classList.remove('hidden');
    } else {
      upgradeBanner.classList.add('hidden');
    }
  }

  // Bind all event listeners
  bindEvents() {
    // Google login
    document.getElementById('google-login').addEventListener('click', () => this.handleGoogleLogin());

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

    // Fetch review
    document.getElementById('fetch-review').addEventListener('click', () => this.fetchReview());

    // Generate reply
    document.getElementById('generate').addEventListener('click', () => this.generateReply());

    // Copy reply
    document.getElementById('copy-reply').addEventListener('click', () => this.copyReply());

    // Regenerate
    document.getElementById('regenerate').addEventListener('click', () => this.generateReply());

    // Use reply
    document.getElementById('use-reply').addEventListener('click', () => this.insertReply());

    // Tone buttons
    document.querySelectorAll('.tone-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectTone(btn));
    });

    // Platform buttons
    document.querySelectorAll('.platform-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectPlatform(btn));
    });

    // Upgrade button
    document.getElementById('upgrade-btn').addEventListener('click', () => this.handleUpgrade());

    // View history
    document.getElementById('view-history').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'http://localhost:3000/history' });
    });

    // View stats
    document.getElementById('view-stats').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'http://localhost:3000/stats' });
    });
  }

  // Handle Google login
  async handleGoogleLogin() {
    try {
      this.showStatus('loading', 'Signing in...');
      
      const response = await chrome.runtime.sendMessage({ action: 'googleLogin' });
      
      if (response && response.success) {
        this.user = response.user;
        this.showMainSection();
        this.showStatus('success', 'Signed in successfully!');
        setTimeout(() => this.hideStatus(), 2000);
      } else {
        throw new Error(response?.error || 'Login failed');
      }
    } catch (error) {
      this.showStatus('error', error.message || 'Login failed');
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  // Handle logout
  async handleLogout() {
    try {
      await chrome.runtime.sendMessage({ action: 'logout' });
      this.user = null;
      this.showLoginSection();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Handle upgrade
  async handleUpgrade() {
    try {
      const { authToken } = await chrome.storage.local.get('authToken');
      
      const response = await fetch('http://localhost:3000/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      
      if (data.success && data.data.url) {
        chrome.tabs.create({ url: data.data.url });
      } else {
        throw new Error(data.message || 'Failed to create checkout');
      }
    } catch (error) {
      this.showStatus('error', error.message || 'Failed to start checkout');
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  // Select tone
  selectTone(btn) {
    this.selectedTone = btn.dataset.tone;
    this.updateToneButtons();
  }

  // Update tone buttons
  updateToneButtons() {
    document.querySelectorAll('.tone-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tone === this.selectedTone);
    });
  }

  // Select platform
  selectPlatform(btn) {
    this.selectedPlatform = btn.dataset.platform;
    this.updatePlatformButtons();
  }

  // Update platform buttons
  updatePlatformButtons() {
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

  // Fetch review from current page
  async fetchReview() {
    try {
      this.showStatus('loading', 'Getting review from page...');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getReview' });
      
      if (response && response.review) {
        document.getElementById('review-text').value = response.review;
        this.showStatus('success', 'Review captured!');
        setTimeout(() => this.hideStatus(), 2000);
      } else {
        this.showStatus('error', 'No review found on this page.');
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

    try {
      const generateBtn = document.getElementById('generate');
      generateBtn.disabled = true;
      generateBtn.innerHTML = `
        <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Generating...
      `;
      this.showStatus('loading', 'AI is crafting your reply...');

      const response = await chrome.runtime.sendMessage({
        action: 'generateReply',
        review: reviewText,
        tone: this.selectedTone,
        platform: this.selectedPlatform
      });

      if (response && response.success) {
        document.getElementById('reply-text').textContent = response.reply;
        document.getElementById('result').classList.remove('hidden');
        
        // Update credits
        if (response.creditsRemaining !== undefined && this.user) {
          this.user.creditsRemaining = response.creditsRemaining;
          this.updateUserUI();
        }
        
        this.showStatus('success', 'Reply generated!');
        setTimeout(() => this.hideStatus(), 2000);
      } else {
        throw new Error(response?.error || 'Failed to generate reply');
      }
    } catch (e) {
      this.showStatus('error', e.message || 'Failed to generate reply');
      setTimeout(() => this.hideStatus(), 3000);
    } finally {
      const generateBtn = document.getElementById('generate');
      generateBtn.disabled = false;
      generateBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
      this.showStatus('success', 'Copied!');
      setTimeout(() => this.hideStatus(), 2000);
    } catch (e) {
      this.showStatus('error', 'Failed to copy');
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
      
      this.showStatus('success', 'Reply inserted!');
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
