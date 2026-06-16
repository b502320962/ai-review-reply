// AI Review Reply - Options Script

const API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  checkLoginStatus();
});

// Load saved settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['apiKey', 'mode', 'authToken', 'user']);
  
  // Set mode
  const mode = result.mode || 'apikey';
  switchMode(mode);
  
  // Load API key
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey;
  }
  
  // Check login status
  if (result.authToken && result.user) {
    showUserInfo(result.user);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Mode selector
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      switchMode(mode);
      chrome.storage.local.set({ mode });
    });
  });
  
  // Save API key
  document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
  
  // Google login
  document.getElementById('googleLoginBtn').addEventListener('click', handleGoogleLogin);
  
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

// Switch between modes
function switchMode(mode) {
  // Update UI
  document.querySelectorAll('.mode-card').forEach(card => {
    card.classList.toggle('active', card.dataset.mode === mode);
  });
  
  document.getElementById('apikey-section').classList.toggle('hidden', mode !== 'apikey');
  document.getElementById('login-section').classList.toggle('hidden', mode !== 'login');
}

// Save API key
async function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const status = document.getElementById('status');
  
  if (!apiKey) {
    showStatus('请输入 API Key', 'error');
    return;
  }
  
  if (!apiKey.startsWith('sk-')) {
    showStatus('API Key 格式不正确', 'error');
    return;
  }
  
  await chrome.storage.local.set({ apiKey, mode: 'apikey' });
  showStatus('API Key 已保存!', 'success');
}

// Google login
async function handleGoogleLogin() {
  try {
    // Get Google OAuth token
    const token = await chrome.identity.getAuthToken({ interactive: true });
    
    if (!token) {
      throw new Error('获取 Google token 失败');
    }

    // Send to backend
    const response = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: token })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || '登录失败');
    }

    const data = await response.json();
    
    // Save to storage
    await chrome.storage.local.set({
      authToken: data.data.token,
      user: data.data.user,
      mode: 'login'
    });

    showUserInfo(data.data.user);
    showStatus('登录成功!', 'success');
    
    // Switch to login mode UI
    switchMode('login');
    
  } catch (error) {
    console.error('Login error:', error);
    showStatus('登录失败: ' + error.message, 'error');
  }
}

// Show user info
function showUserInfo(user) {
  document.getElementById('not-logged-in').classList.add('hidden');
  document.getElementById('logged-in').classList.remove('hidden');
  
  document.getElementById('userAvatar').src = user.avatar || '';
  document.getElementById('userName').textContent = user.name || 'User';
  document.getElementById('userEmail').textContent = user.email || '';
  
  // Show credits
  const creditsInfo = document.getElementById('creditsInfo');
  if (user.creditsRemaining !== undefined) {
    creditsInfo.textContent = `本月剩余 ${user.creditsRemaining} 次`;
  }
}

// Logout
async function handleLogout() {
  await chrome.storage.local.remove(['authToken', 'user']);
  
  document.getElementById('not-logged-in').classList.remove('hidden');
  document.getElementById('logged-in').classList.add('hidden');
  
  showStatus('已退出登录', 'success');
}

// Check login status
async function checkLoginStatus() {
  const { authToken } = await chrome.storage.local.get('authToken');
  
  if (!authToken) return;
  
  try {
    const response = await fetch(`${API_BASE}/user/profile`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        await chrome.storage.local.set({ user: data.data });
        showUserInfo(data.data);
      }
    } else {
      // Token expired
      await chrome.storage.local.remove(['authToken', 'user']);
    }
  } catch (error) {
    // Backend not available
    console.log('Backend not available');
  }
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  
  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}
