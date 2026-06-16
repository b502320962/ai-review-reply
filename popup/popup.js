// AI Review Reply - Popup Script

let currentTab = null;
let userSettings = {};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await checkStatus();
  setupEventListeners();
});

// Load settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['apiKey', 'platform', 'autoDetect']);
  userSettings = {
    apiKey: result.apiKey || '',
    platform: result.platform || 'auto',
    autoDetect: result.autoDetect !== false
  };
}

// Check current tab status
async function checkStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  
  const statusEl = document.getElementById('status');
  const platformEl = document.getElementById('platform');
  const generateBtn = document.getElementById('generateBtn');
  
  // Detect platform
  const url = tab.url || '';
  let platform = 'unknown';
  
  if (url.includes('business.google.com') || url.includes('google.com/business')) {
    platform = 'google';
  } else if (url.includes('yelp.com')) {
    platform = 'yelp';
  } else if (url.includes('mp.weixin.qq.com')) {
    platform = 'wechat';
  }
  
  platformEl.textContent = getPlatformName(platform);
  
  // Check API key
  if (!userSettings.apiKey) {
    statusEl.textContent = '请先配置 API Key';
    statusEl.className = 'status warning';
    generateBtn.disabled = true;
    return;
  }
  
  if (platform !== 'unknown') {
    statusEl.textContent = '已就绪';
    statusEl.className = 'status success';
    generateBtn.disabled = false;
  } else {
    statusEl.textContent = '不支持的平台';
    statusEl.className = 'status error';
    generateBtn.disabled = true;
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('generateBtn').addEventListener('click', generateReply);
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// Generate reply
async function generateReply() {
  const resultDiv = document.getElementById('result');
  const replyText = document.getElementById('replyText');
  const generateBtn = document.getElementById('generateBtn');
  
  generateBtn.disabled = true;
  generateBtn.textContent = '生成中...';
  resultDiv.style.display = 'block';
  replyText.textContent = '正在分析评论并生成回复...';
  
  try {
    // Get review from current page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getReview' });
    
    if (!response || !response.review) {
      throw new Error('无法获取评论内容，请确保页面已加载完成');
    }
    
    // Generate AI reply
    const reply = await callDeepSeek(response.review);
    
    replyText.textContent = reply;
    
    // Copy button
    document.getElementById('copyBtn').onclick = () => {
      navigator.clipboard.writeText(reply);
      const copyBtn = document.getElementById('copyBtn');
      copyBtn.textContent = '已复制!';
      setTimeout(() => copyBtn.textContent = '复制回复', 2000);
    };
    
  } catch (error) {
    replyText.textContent = '错误: ' + error.message;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = '生成智能回复';
  }
}

// Call DeepSeek API
async function callDeepSeek(review) {
  const prompt = `你是一个专业的商家回复助手。请根据以下顾客评论，生成一段专业、友好、有帮助的商家回复。

回复要求：
1. 感谢顾客的反馈
2. 针对评论中的具体问题进行回应
3. 如果是负面评论，表达歉意并说明改进措施
4. 如果是正面评论，表达感谢并邀请再次光临
5. 保持专业和友好的语气
6. 回复长度适中（100-200字）

顾客评论：
${review}

请直接给出回复内容，不需要其他说明。`;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userSettings.apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是专业的商家回复助手，帮助商家回复顾客评论。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('API Key 无效，请在设置中检查');
    }
    throw new Error(error.error?.message || 'AI 服务请求失败');
  }
  
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Helper
function getPlatformName(platform) {
  const names = {
    google: 'Google Business',
    yelp: 'Yelp',
    wechat: '微信公众号',
    unknown: '不支持的平台'
  };
  return names[platform] || platform;
}
