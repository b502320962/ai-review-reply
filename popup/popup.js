// AI Review Reply - Popup Script

let currentTab = null;
let userSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await checkStatus();
  setupEventListeners();
});

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.local.get(['apiKey', 'mode', 'user']);
  userSettings = {
    apiKey: result.apiKey || '',
    mode: result.mode || 'apikey',
    user: result.user || null,
  };
}

// 检查当前页面状态
async function checkStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const statusEl = document.getElementById('status');
  const platformEl = document.getElementById('platform');
  const generateBtn = document.getElementById('generateBtn');
  const modeInfoEl = document.getElementById('modeInfo');

  // 检测平台
  const url = tab.url || '';
  let platform = 'unknown';
  if (url.includes('business.google.com') || url.includes('google.com/business')) platform = 'google';
  else if (url.includes('yelp.com')) platform = 'yelp';
  else if (url.includes('mp.weixin.qq.com')) platform = 'wechat';

  platformEl.textContent = getPlatformName(platform);

  // 检查是否就绪
  const isReady = platform !== 'unknown' && (
    (userSettings.mode === 'apikey' && userSettings.apiKey) ||
    (userSettings.mode === 'login' && userSettings.user)
  );

  // 显示模式信息
  if (userSettings.mode === 'apikey') {
    modeInfoEl.textContent = userSettings.apiKey ? '🔑 API Key 模式' : '⚠️ 请先配置 API Key';
    modeInfoEl.className = userSettings.apiKey ? 'mode-info success' : 'mode-info warning';
  } else {
    if (userSettings.user) {
      const credits = userSettings.user.creditsRemaining ?? '?';
      modeInfoEl.textContent = `👤 ${userSettings.user.name || '已登录'} · 剩余 ${credits} 次`;
      modeInfoEl.className = 'mode-info success';
    } else {
      modeInfoEl.textContent = '⚠️ 请先登录';
      modeInfoEl.className = 'mode-info warning';
    }
  }

  if (isReady) {
    statusEl.textContent = '已就绪';
    statusEl.className = 'status success';
    generateBtn.disabled = false;
  } else if (platform === 'unknown') {
    statusEl.textContent = '不支持的平台';
    statusEl.className = 'status error';
    generateBtn.disabled = true;
  } else {
    statusEl.textContent = '未配置';
    statusEl.className = 'status warning';
    generateBtn.disabled = true;
  }
}

// 设置事件监听
function setupEventListeners() {
  document.getElementById('generateBtn').addEventListener('click', generateReply);
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// 生成回复
async function generateReply() {
  const resultDiv = document.getElementById('result');
  const replyText = document.getElementById('replyText');
  const generateBtn = document.getElementById('generateBtn');

  generateBtn.disabled = true;
  generateBtn.textContent = '生成中...';
  resultDiv.style.display = 'block';
  replyText.textContent = '正在分析评论并生成回复...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getReview' });

    if (!response || !response.review) {
      throw new Error('无法获取评论内容，请确保页面已加载完成');
    }

    // 调用 background 生成回复
    const result = await chrome.runtime.sendMessage({
      action: 'generateReply',
      review: response.review,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    replyText.textContent = result.reply;

    document.getElementById('copyBtn').onclick = () => {
      navigator.clipboard.writeText(result.reply);
      const copyBtn = document.getElementById('copyBtn');
      copyBtn.textContent = '已复制!';
      setTimeout(() => (copyBtn.textContent = '复制回复'), 2000);
    };
  } catch (error) {
    replyText.textContent = '错误: ' + error.message;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = '生成智能回复';
  }
}

function getPlatformName(platform) {
  const names = { google: 'Google Business', yelp: 'Yelp', wechat: '微信公众号', unknown: '不支持的平台' };
  return names[platform] || platform;
}
