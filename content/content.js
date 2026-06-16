// AI Review Reply - Content Script
// Supports Google Business, Yelp, and WeChat Official Account Comments

const API_BASE = 'http://localhost:3000/api';

class ContentScript {
  constructor() {
    this.platform = this.detectPlatform();
    this.init();
  }

  detectPlatform() {
    const url = window.location.href;
    if (url.includes('business.google.com')) return 'google';
    if (url.includes('yelp.com')) return 'yelp';
    if (url.includes('mp.weixin.qq.com')) return 'wechat';
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

    // Add floating button and AI reply buttons based on platform
    if (this.platform === 'wechat') {
      this.initWeChatIntegration();
    } else if (this.platform !== 'unknown') {
      this.addFloatingButton();
    }
  }

  // Get review/message text from page
  getSelectedReview() {
    const selection = window.getSelection().toString().trim();
    if (selection && selection.length > 10) {
      return selection;
    }

    if (this.platform === 'google') return this.getGoogleReview();
    if (this.platform === 'yelp') return this.getYelpReview();
    if (this.platform === 'wechat') return this.getWeChatMessage();
    return null;
  }

  getGoogleReview() {
    const selectors = ['.review-text', '[data-review-text]', '.ODSEW-ShBeI-text', '.review-content'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.textContent.trim();
    }
    return null;
  }

  getYelpReview() {
    const selectors = ['.review-content', '[data-review-content]', '.raw__09f24__T4Ezm'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.textContent.trim();
    }
    return null;
  }

  getWeChatMessage() {
    const selectors = ['.msg_item .msg_content', '.message_content', '.msg_content'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.textContent.trim();
    }
    return null;
  }

  insertReplyToPage(reply) {
    if (this.platform === 'google') return this.insertToGoogle(reply);
    if (this.platform === 'yelp') return this.insertToYelp(reply);
    if (this.platform === 'wechat') return this.insertToWeChat(reply);
  }

  insertToGoogle(reply) {
    const selectors = ['textarea[placeholder*="reply"]', 'textarea[placeholder*="Reply"]', '.reply-textarea', '[data-reply-input]'];
    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea) { textarea.value = reply; textarea.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    }
    return false;
  }

  insertToYelp(reply) {
    const selectors = ['textarea[name*="reply"]', 'textarea[placeholder*="reply"]', '.reply-textarea'];
    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea) { textarea.value = reply; textarea.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    }
    return false;
  }

  insertToWeChat(reply) {
    // 留言回复框的多种选择器
    const selectors = [
      'textarea.reply_input',
      'textarea[name="reply_content"]',
      '.reply_input textarea',
      '#reply_content',
      'textarea[placeholder*="回复"]',
      'textarea[placeholder*="留言"]',
      '.comment_reply textarea',
      // 留言管理页面的回复框
      'textarea[class*="reply"]',
      'textarea[class*="comment"]',
      // 通用 textarea
      '.weui-textarea',
      'textarea'
    ];

    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea && textarea.offsetParent !== null) {
        // 使用原生 setter 确保 React/Vue 检测到变化
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeSetter.call(textarea, reply);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.focus();
        return true;
      }
    }
    return false;
  }

  // ===== WeChat Integration =====

  initWeChatIntegration() {
    // 注入样式
    this.injectWeChatStyles();
    
    // 初次添加按钮
    this.addWeChatCommentButtons();
    
    // 监听 DOM 变化（留言列表可能动态加载）
    this.observeWeChatChanges();
  }

  injectWeChatStyles() {
    if (document.getElementById('ai-reply-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ai-reply-styles';
    style.textContent = `
      /* AI 回复按钮 */
      .ai-reply-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        margin-left: 8px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        vertical-align: middle;
      }
      .ai-reply-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
      }
      .ai-reply-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .ai-reply-btn svg {
        flex-shrink: 0;
      }

      /* 旋转动画 */
      @keyframes ai-spin {
        to { transform: rotate(360deg); }
      }
      .ai-spin {
        animation: ai-spin 1s linear infinite;
      }

      /* 弹窗遮罩 */
      .ai-reply-dialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      .ai-reply-dialog-content {
        background: white;
        border-radius: 12px;
        width: 520px;
        max-width: 90vw;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: ai-dialog-in 0.2s ease-out;
      }
      @keyframes ai-dialog-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      .ai-reply-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
      }
      .ai-reply-dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
      }
      .ai-reply-dialog-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .ai-reply-dialog-close:hover { color: #1f2937; }

      .ai-reply-dialog-body {
        padding: 20px;
        overflow-y: auto;
        max-height: 400px;
      }

      /* 消息卡片 */
      .ai-reply-card {
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .ai-reply-card:last-child { margin-bottom: 0; }
      .ai-reply-card-label {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
      }
      .ai-reply-card-content {
        font-size: 14px;
        line-height: 1.6;
        color: #1f2937;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .ai-reply-generated {
        background: #f0f0ff;
        border-color: #c7d2fe;
      }
      .ai-reply-generated .ai-reply-card-label { color: #4f46e5; }

      /* 底部按钮 */
      .ai-reply-dialog-footer {
        display: flex;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
      }
      .ai-reply-btn-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        flex: 1;
      }
      .ai-reply-btn-secondary {
        background: white;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      .ai-reply-btn-secondary:hover { background: #f3f4f6; }
      .ai-reply-btn-primary {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
      }
      .ai-reply-btn-primary:hover { opacity: 0.9; }
    `;
    document.head.appendChild(style);
  }

  // 添加按钮到留言列表
  addWeChatCommentButtons() {
    // 微信公众号留言管理页面的留言项选择器
    // 尝试多种可能的选择器
    const commentSelectors = [
      '.comment_item',           // 留言项
      '.comment-item',
      '.msg_item',
      '.message_item',
      '[class*="comment"]',
      '[class*="Comment"]',
      // 通用：查找包含回复按钮的区域
    ];

    // 方法1：直接匹配已知类名
    for (const selector of commentSelectors) {
      const items = document.querySelectorAll(selector);
      if (items.length > 0) {
        items.forEach(item => this.addButtonToCommentItem(item));
        return;
      }
    }

    // 方法2：查找操作栏（包含点赞/踩/回复/更多按钮的区域）
    // 这些按钮通常在一个容器里
    const actionBars = document.querySelectorAll('[class*="action"], [class*="tool"], [class*="operate"]');
    actionBars.forEach(bar => {
      // 检查是否包含多个按钮（点赞、踩、回复、更多）
      const buttons = bar.querySelectorAll('button, [role="button"], span[class*="icon"], i[class*="icon"]');
      if (buttons.length >= 3) {
        // 可能是留言操作栏
        const commentItem = bar.closest('[class*="comment"], [class*="item"], [class*="msg"]');
        if (commentItem && !commentItem.querySelector('.ai-reply-btn')) {
          this.addButtonToActionBar(bar, commentItem);
        }
      }
    });

    // 方法3：查找所有包含"回复"文字的按钮，然后在其父容器添加 AI 按钮
    document.querySelectorAll('button, [role="button"], span, a').forEach(el => {
      if (el.textContent.trim() === '回复' || el.getAttribute('title') === '回复') {
        const actionBar = el.parentElement;
        if (actionBar && !actionBar.querySelector('.ai-reply-btn')) {
          const commentItem = actionBar.closest('[class*="comment"], [class*="item"], article, section');
          if (commentItem) {
            this.addButtonToActionBar(actionBar, commentItem);
          }
        }
      }
    });
  }

  // 给留言项添加按钮
  addButtonToCommentItem(item) {
    if (item.querySelector('.ai-reply-btn')) return; // 已添加

    // 获取留言内容
    const contentEl = item.querySelector('[class*="content"], [class*="text"], p');
    if (!contentEl) return;

    // 查找操作栏
    const actionBar = item.querySelector('[class*="action"], [class*="tool"], [class*="operate"], footer');
    if (actionBar) {
      this.addButtonToActionBar(actionBar, item);
    } else {
      // 没找到操作栏，直接在内容后添加
      const btn = this.createAIReplyButton(item);
      contentEl.after(btn);
    }
  }

  // 在操作栏添加按钮
  addButtonToActionBar(actionBar, commentItem) {
    if (actionBar.querySelector('.ai-reply-btn')) return;
    
    const btn = this.createAIReplyButton(commentItem);
    actionBar.appendChild(btn);
  }

  // 创建 AI 回复按钮
  createAIReplyButton(commentItem) {
    const btn = document.createElement('button');
    btn.className = 'ai-reply-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      AI回复
    `;
    btn.title = '使用AI生成回复';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleCommentAIReply(commentItem, btn);
    });

    return btn;
  }

  // 处理 AI 回复
  async handleCommentAIReply(commentItem, btn) {
    // 获取留言内容
    const contentEl = commentItem.querySelector('[class*="content"], [class*="text"], p');
    const nicknameEl = commentItem.querySelector('[class*="nick"], [class*="name"], [class*="user"]');
    
    const commentText = contentEl ? contentEl.textContent.trim() : '';
    const nickname = nicknameEl ? nicknameEl.textContent.trim() : '用户';

    if (!commentText) {
      alert('无法获取留言内容');
      return;
    }

    // 显示加载状态
    const originalText = btn.innerHTML;
    btn.innerHTML = `
      <svg class="ai-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      生成中...
    `;
    btn.disabled = true;

    try {
      // 获取 API Key
      const { apiKey, mode, authToken } = await chrome.storage.local.get(['apiKey', 'mode', 'authToken']);
      
      let reply;
      
      if (mode === 'login' && authToken) {
        reply = await this.generateReplyViaBackend(authToken, commentText);
      } else if (apiKey) {
        reply = await this.callDeepSeekAPI(apiKey, commentText, nickname);
      } else {
        alert('请先在插件设置中配置 API Key 或登录');
        chrome.runtime.openOptionsPage();
        return;
      }

      // 显示回复弹窗
      this.showReplyDialog(commentItem, nickname, commentText, reply);
    } catch (error) {
      console.error('AI reply error:', error);
      alert('生成回复失败: ' + error.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  // 调用 DeepSeek API
  async callDeepSeekAPI(apiKey, comment, nickname) {
    const prompt = `你是一个公众号运营者，需要回复读者的留言评论。请根据以下留言内容，生成一段友好、专业、有帮助的回复。

回复要求：
1. 称呼读者为"${nickname}"
2. 感谢读者的留言和关注
3. 针对留言内容进行有价值的回应
4. 如果是问题，给出解答或建议
5. 如果是分享/赞美，表示感谢并鼓励继续交流
6. 保持亲切、专业的语气
7. 回复长度适中（50-150字）
8. 可以适当使用 emoji 表情

读者留言：
${comment}

请直接给出回复内容，不需要其他说明。`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是专业的公众号运营助手，帮助运营者回复读者留言。回复要亲切、有价值。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('API Key 无效，请在设置中检查');
      throw new Error(error.error?.message || 'AI 服务请求失败');
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  // 通过后端生成回复
  async generateReplyViaBackend(token, comment) {
    const response = await fetch(`${API_BASE}/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ review: comment, tone: 'friendly', platform: 'wechat' })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('登录已过期');
      if (response.status === 429) throw new Error('免费额度已用完');
      throw new Error(error.message || '生成回复失败');
    }
    
    const data = await response.json();
    return data.data.reply;
  }

  // 显示回复弹窗
  showReplyDialog(commentItem, nickname, originalComment, reply) {
    // 移除已有弹窗
    const existing = document.getElementById('ai-reply-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'ai-reply-dialog';
    dialog.className = 'ai-reply-dialog';
    dialog.innerHTML = `
      <div class="ai-reply-dialog-content">
        <div class="ai-reply-dialog-header">
          <div class="ai-reply-dialog-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>AI 智能回复</span>
          </div>
          <button class="ai-reply-dialog-close" id="ai-dialog-close">&times;</button>
        </div>
        
        <div class="ai-reply-dialog-body">
          <div class="ai-reply-card">
            <div class="ai-reply-card-label">👤 ${nickname} 的留言</div>
            <div class="ai-reply-card-content">${originalComment}</div>
          </div>
          
          <div class="ai-reply-card ai-reply-generated">
            <div class="ai-reply-card-label">✨ AI 生成的回复</div>
            <div class="ai-reply-card-content" id="ai-reply-text">${reply}</div>
          </div>
        </div>
        
        <div class="ai-reply-dialog-footer">
          <button class="ai-reply-btn-action ai-reply-btn-secondary" id="ai-reply-regenerate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            重新生成
          </button>
          <button class="ai-reply-btn-action ai-reply-btn-secondary" id="ai-reply-copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
            </svg>
            复制回复
          </button>
          <button class="ai-reply-btn-action ai-reply-btn-primary" id="ai-reply-use">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            使用回复
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // 事件绑定
    document.getElementById('ai-dialog-close').onclick = () => dialog.remove();
    
    document.getElementById('ai-reply-copy').onclick = async () => {
      const text = document.getElementById('ai-reply-text').textContent;
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('ai-reply-copy');
      btn.textContent = '已复制!';
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
          </svg>
          复制回复
        `;
      }, 2000);
    };

    document.getElementById('ai-reply-use').onclick = () => {
      const text = document.getElementById('ai-reply-text').textContent;
      this.insertReplyToComment(commentItem, text);
      dialog.remove();
    };

    document.getElementById('ai-reply-regenerate').onclick = async () => {
      dialog.remove();
      const btn = commentItem.querySelector('.ai-reply-btn');
      if (btn) {
        btn.click(); // 重新触发生成
      }
    };

    // 点击遮罩关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  // 将回复插入到留言的回复框
  insertReplyToComment(commentItem, reply) {
    // 方法1：在留言项内查找回复输入框
    const replyTextarea = commentItem.querySelector(
      'textarea, [contenteditable="true"], input[type="text"]'
    );
    
    if (replyTextarea) {
      this.fillTextarea(replyTextarea, reply);
      return;
    }

    // 方法2：点击"回复"按钮展开回复框，然后填入
    const replyBtn = commentItem.querySelector(
      '[class*="reply"], [title="回复"], button'
    );
    
    if (replyBtn) {
      // 查找包含"回复"文字的按钮
      const allBtns = commentItem.querySelectorAll('button, [role="button"], span, a');
      for (const btn of allBtns) {
        if (btn.textContent.trim() === '回复' || btn.getAttribute('title') === '回复') {
          btn.click();
          break;
        }
      }
      
      // 等待回复框出现
      setTimeout(() => {
        const textarea = commentItem.querySelector('textarea, [contenteditable="true"]');
        if (textarea) {
          this.fillTextarea(textarea, reply);
        } else {
          // 如果还是找不到，复制到剪贴板
          navigator.clipboard.writeText(reply);
          alert('已复制回复到剪贴板，请手动粘贴到回复框');
        }
      }, 500);
    } else {
      // 兜底：复制到剪贴板
      navigator.clipboard.writeText(reply);
      alert('已复制回复到剪贴板，请手动粘贴到回复框');
    }
  }

  // 填充文本到输入框
  fillTextarea(textarea, reply) {
    if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      nativeSetter.call(textarea, reply);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // contenteditable
      textarea.textContent = reply;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    textarea.focus();
  }

  // 监听 DOM 变化
  observeWeChatChanges() {
    const observer = new MutationObserver(() => {
      // 防抖：多次变化只执行一次
      clearTimeout(this._observeTimer);
      this._observeTimer = setTimeout(() => {
        this.addWeChatCommentButtons();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Google/Yelp 浮动按钮
  addFloatingButton() {
    const button = document.createElement('div');
    button.id = 'ai-reply-button';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    button.title = 'AI Reply';

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
    `;

    document.head.appendChild(style);
    document.body.appendChild(button);
    button.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openPopup' }));
  }
}

// Initialize
new ContentScript();
