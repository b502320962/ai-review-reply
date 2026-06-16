// AI Review Reply - Options Script

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// Load saved settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['apiKey']);
  
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey;
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
}

// Save settings
async function saveSettings() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const status = document.getElementById('status');
  
  if (!apiKey) {
    status.textContent = '请输入 API Key';
    status.className = 'status error';
    return;
  }
  
  if (!apiKey.startsWith('sk-')) {
    status.textContent = 'API Key 格式不正确';
    status.className = 'status error';
    return;
  }
  
  await chrome.storage.local.set({ apiKey });
  
  status.textContent = '设置已保存!';
  status.className = 'status success';
  
  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}
