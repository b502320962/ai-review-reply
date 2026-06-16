// AI Review Reply - Background Service Worker

const API_BASE = 'http://localhost:3000/api';

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateReply') {
    handleGenerateReply(request)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (request.action === 'openPopup') {
    chrome.action.openPopup();
  }

  if (request.action === 'googleLogin') {
    handleGoogleLogin()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'logout') {
    handleLogout().then(sendResponse);
    return true;
  }

  if (request.action === 'getUserInfo') {
    handleGetUserInfo()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Google OAuth login
async function handleGoogleLogin() {
  try {
    // Get Google OAuth token
    const token = await chrome.identity.getAuthToken({ interactive: true });
    
    if (!token) {
      throw new Error('Failed to get Google token');
    }

    // Send to our backend
    const response = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: token })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    
    // Save to storage
    await chrome.storage.local.set({
      authToken: data.data.token,
      user: data.data.user
    });

    return { success: true, user: data.data.user };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Logout
async function handleLogout() {
  await chrome.storage.local.remove(['authToken', 'user']);
  return { success: true };
}

// Get user info from storage
async function handleGetUserInfo() {
  const { authToken, user } = await chrome.storage.local.get(['authToken', 'user']);
  
  if (!authToken || !user) {
    return { success: false, message: 'Not logged in' };
  }

  // Verify token is still valid
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!response.ok) {
      // Token expired, clear storage
      await chrome.storage.local.remove(['authToken', 'user']);
      return { success: false, message: 'Session expired' };
    }

    const data = await response.json();
    return { success: true, user: data.data };
  } catch (error) {
    return { success: true, user }; // Return cached user if offline
  }
}

// Generate AI reply
async function handleGenerateReply({ review, tone, platform }) {
  const { authToken } = await chrome.storage.local.get('authToken');
  
  if (!authToken) {
    throw new Error('Please login first');
  }

  const response = await fetch(`${API_BASE}/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ review, tone, platform })
  });

  if (!response.ok) {
    const error = await response.json();
    
    if (error.code === 'NO_CREDITS') {
      throw new Error('No credits remaining. Please upgrade to Pro.');
    }
    
    throw new Error(error.message || 'Failed to generate reply');
  }

  const data = await response.json();
  
  // Update cached credits
  const { user } = await chrome.storage.local.get('user');
  if (user) {
    user.creditsRemaining = data.data.creditsRemaining;
    await chrome.storage.local.set({ user });
  }

  return { 
    success: true, 
    reply: data.data.reply,
    creditsRemaining: data.data.creditsRemaining
  };
}

// Install handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open popup on install
    chrome.action.openPopup();
  }
});
