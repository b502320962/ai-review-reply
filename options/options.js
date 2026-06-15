// AI Review Reply - Options Page Script

class OptionsPage {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.bindEvents();
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.local.get([
        'apiKey',
        'defaultTone',
        'replyLength',
        'currentPlan'
      ]);

      // Set API key (masked)
      if (settings.apiKey) {
        document.getElementById('api-key').value = settings.apiKey;
      }

      // Set default tone
      if (settings.defaultTone) {
        document.getElementById('default-tone').value = settings.defaultTone;
      }

      // Set reply length
      if (settings.replyLength) {
        document.getElementById('reply-length').value = settings.replyLength;
      }

      // Set current plan
      if (settings.currentPlan) {
        this.setActivePlan(settings.currentPlan);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  bindEvents() {
    // Save API key
    document.getElementById('save-key').addEventListener('click', () => this.saveApiKey());

    // Test API key
    document.getElementById('test-key').addEventListener('click', () => this.testApiKey());

    // Save settings
    document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());

    // Plan selection
    document.querySelectorAll('.plan-card').forEach(card => {
      card.addEventListener('click', () => this.selectPlan(card));
    });
  }

  async saveApiKey() {
    const apiKey = document.getElementById('api-key').value.trim();

    if (!apiKey) {
      this.showStatus('api-status', 'error', 'Please enter an API key');
      return;
    }

    try {
      await chrome.storage.local.set({ apiKey });
      this.showStatus('api-status', 'success', 'API key saved successfully!');
    } catch (e) {
      this.showStatus('api-status', 'error', 'Failed to save API key');
    }
  }

  async testApiKey() {
    const apiKey = document.getElementById('api-key').value.trim();

    if (!apiKey) {
      this.showStatus('api-status', 'error', 'Please enter an API key first');
      return;
    }

    try {
      this.showStatus('api-status', 'loading', 'Testing connection...');

      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        this.showStatus('api-status', 'success', 'Connection successful! API key is valid.');
        await chrome.storage.local.set({ apiKey });
      } else {
        const error = await response.json();
        this.showStatus('api-status', 'error', error.error?.message || 'Invalid API key');
      }
    } catch (e) {
      this.showStatus('api-status', 'error', 'Connection failed. Please check your network.');
    }
  }

  async saveSettings() {
    const defaultTone = document.getElementById('default-tone').value;
    const replyLength = document.getElementById('reply-length').value;

    try {
      await chrome.storage.local.set({ defaultTone, replyLength });
      this.showStatus('settings-status', 'success', 'Settings saved successfully!');
    } catch (e) {
      this.showStatus('settings-status', 'error', 'Failed to save settings');
    }
  }

  selectPlan(card) {
    // Remove active class from all cards
    document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
    
    // Add active class to selected card
    card.classList.add('active');
    
    // Save selected plan
    const plan = card.dataset.plan;
    chrome.storage.local.set({ currentPlan: plan });
  }

  setActivePlan(plan) {
    document.querySelectorAll('.plan-card').forEach(card => {
      card.classList.toggle('active', card.dataset.plan === plan);
    });
  }

  showStatus(elementId, type, message) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;

    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
    statusEl.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  new OptionsPage();
});
