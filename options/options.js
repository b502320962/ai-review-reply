// AI Review Reply - Options Script

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  checkLoginStatus();
});

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.local.get(['apiKey', 'mode']);
  const mode = result.mode || 'apikey';
  switchMode(mode);
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey;
  }
}

// 设置事件监听
function setupEventListeners() {
  // 模式切换
  document.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      switchMode(mode);
      chrome.storage.local.set({ mode });
    });
  });

  // 保存 API Key
  document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);

  // Google 登录
  document.getElementById('googleLoginBtn').addEventListener('click', handleGoogleLogin);

  // 登出
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

// 切换模式
function switchMode(mode) {
  document.querySelectorAll('.mode-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.mode === mode);
  });
  document.getElementById('apikey-section').classList.toggle('hidden', mode !== 'apikey');
  document.getElementById('login-section').classList.toggle('hidden', mode !== 'login');
}

// 保存 API Key
async function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
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

// Google 登录（通过 Supabase）
async function handleGoogleLogin() {
  try {
    document.getElementById('googleLoginBtn').disabled = true;
    document.getElementById('googleLoginBtn').textContent = '登录中...';

    const result = await chrome.runtime.sendMessage({ action: 'googleLogin' });

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.success) {
      showUserInfo(result.user);
      showStatus('登录成功!', 'success');
      switchMode('login');
    }
  } catch (error) {
    showStatus('登录失败: ' + error.message, 'error');
  } finally {
    document.getElementById('googleLoginBtn').disabled = false;
    document.getElementById('googleLoginBtn').innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      使用 Google 登录
    `;
  }
}

// 显示用户信息
function showUserInfo(user) {
  document.getElementById('not-logged-in').classList.add('hidden');
  document.getElementById('logged-in').classList.remove('hidden');
  document.getElementById('userAvatar').src = user.avatar || '';
  document.getElementById('userName').textContent = user.name || 'User';
  document.getElementById('userEmail').textContent = user.email || '';

  const creditsInfo = document.getElementById('creditsInfo');
  if (user.creditsRemaining !== undefined) {
    creditsInfo.textContent = `本月剩余 ${user.creditsRemaining} 次 (${user.plan || 'free'} 计划)`;
  }
}

// 检查登录状态
async function checkLoginStatus() {
  const result = await chrome.runtime.sendMessage({ action: 'getUserInfo' });
  if (result.success && result.user) {
    showUserInfo(result.user);
    switchMode('login');
  }
}

// 登出
async function handleLogout() {
  await chrome.runtime.sendMessage({ action: 'logout' });
  document.getElementById('not-logged-in').classList.remove('hidden');
  document.getElementById('logged-in').classList.add('hidden');
  showStatus('已退出登录', 'success');
}

// 显示状态消息
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => (status.className = 'status'), 3000);
}
