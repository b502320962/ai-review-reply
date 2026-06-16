// AI Review Reply - Content Script
// Supports Google Business, Yelp, and WeChat Official Account

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
    // Try to get selected text first
    const selection = window.getSelection().toString().trim();
    if (selection && selection.length > 10) {
      return selection;
    }

    // Otherwise try to find review based on platform
    if (this.platform === 'google') {
      return this.getGoogleReview();
    } else if (this.platform === 'yelp') {
      return this.getYelpReview();
    } else if (this.platform === 'wechat') {
      return this.getWeChatMessage();
    }

    return null;
  }

  // Get review from Google Business
  getGoogleReview() {
    const selectors = [
      '.review-text',
      '[data-review-text]',
      '.ODSEW-ShBeI-text',
      '.review-content'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  // Get review from Yelp
  getYelpReview() {
    const selectors = [
      '.review-content',
      '[data-review-content]',
      '.raw__09f24__T4Ezm'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  // Get message from WeChat Official Account
  getWeChatMessage() {
    // WeChat message selectors for mp.weixin.qq.com
    const selectors = [
      '.msg_item .msg_content',
      '.message_content',
      '.msg_content',
      '.text_msg .msg_content',
      '.comment_content',
      '.reply_content'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    // Try to get from the currently selected/focused message
    const activeElement = document.activeElement;
    if (activeElement && activeElement.classList.contains('msg_content')) {
      return activeElement.textContent.trim();
    }

    return null;
  }

  // Insert reply into reply textarea
  insertReplyToPage(reply) {
    if (this.platform === 'google') {
      this.insertToGoogle(reply);
    } else if (this.platform === 'yelp') {
      this.insertToYelp(reply);
    } else if (this.platform === 'wechat') {
      this.insertToWeChat(reply);
    }
  }

  // Insert reply to Google Business
  insertToGoogle(reply) {
    const selectors = [
      'textarea[placeholder*="reply"]',
      'textarea[placeholder*="Reply"]',
      '.reply-textarea',
      '[data-reply-input]'
    ];

    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea) {
        textarea.value = reply;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  // Insert reply to Yelp
  insertToYelp(reply) {
    const selectors = [
      'textarea[name*="reply"]',
      'textarea[placeholder*="reply"]',
      '.reply-textarea'
    ];

    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea) {
        textarea.value = reply;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  // Insert reply to WeChat Official Account
  insertToWeChat(reply) {
    // WeChat reply textarea selectors
    const selectors = [
      'textarea.reply_input',
      'textarea[name="reply_content"]',
      '.reply_input textarea',
      '#reply_content',
      '.comment_reply textarea',
      'textarea[placeholder*="回复"]',
      'textarea[placeholder*="reply"]'
    ];

    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea) {
        textarea.value = reply;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        // Trigger React/Vue state update if applicable
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(textarea, reply);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  // Initialize WeChat integration
  initWeChatIntegration() {
    // Add AI reply buttons to each message item
    this.addWeChatReplyButtons();
    
    // Observe DOM changes to add buttons to new messages
    this.observeWeChatChanges();
  }

  // Add AI reply buttons to WeChat messages
  addWeChatReplyButtons() {
    // Selectors for message items in WeChat Official Account backend
    const messageSelectors = [
      '.msg_item',
      '.message_item',
      '.comment_item',
      '.reply_item'
    ];

    messageSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(item => {
        if (item.querySelector('.ai-reply-btn')) return; // Already added
        
        const btn = document.createElement('button');
        btn.className = 'ai-reply-btn';
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          AI智能回复
        `;
        btn.title = '使用AI生成回复';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleWeChatAIReply(item);
        });

        // Find the reply button area or action area
        const actionArea = item.querySelector('.msg_action, .message_action, .comment_action, .reply_action, .msg_tool');
        if (actionArea) {
          actionArea.appendChild(btn);
        } else {
          // Add after the message content
          const content = item.querySelector('.msg_content, .message_content, .comment_content');
          if (content) {
            content.after(btn);
          }
        }
      });
    });
  }

  // Handle AI reply for WeChat message
  async handleWeChatAIReply(messageItem) {
    // Get message content
    const contentEl = messageItem.querySelector('.msg_content, .message_content, .comment_content, .text_msg .msg_content');
    if (!contentEl) {
      alert('无法获取消息内容');
      return;
    }

    const messageText = contentEl.textContent.trim();
    if (!messageText) {
      alert('消息内容为空');
      return;
    }

    // Show loading state
    const btn = messageItem.querySelector('.ai-reply-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `
      <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      生成中...
    `;
    btn.disabled = true;

    try {
      // Get settings from storage
      const { apiKey, mode, authToken } = await chrome.storage.local.get(['apiKey', 'mode', 'authToken']);
      
      let reply;
      
      if (mode === 'login' && authToken) {
        // Use backend API
        reply = await this.generateReplyViaBackend(authToken, messageText);
      } else if (apiKey) {
        // Use DeepSeek API directly
        reply = await this.callDeepSeekAPI(apiKey, messageText);
      } else {
        alert('请先在插件设置中配置 API Key 或登录');
        chrome.runtime.openOptionsPage();
        return;
      }

      // Show reply in a modal/dialog
      this.showWeChatReplyDialog(messageItem, messageText, reply);
    } catch (error) {
      console.error('AI reply error:', error);
      alert('生成回复失败: ' + error.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  // Generate reply via backend
  async generateReplyViaBackend(token, review) {
    const response = await fetch(`${API_BASE}/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        review: review,
        tone: 'professional',
        platform: 'wechat'
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }
      if (response.status === 429) {
        throw new Error('免费额度已用完，请升级或使用 API Key 模式');
      }
      throw new Error(error.message || '生成回复失败');
    }
    
    const data = await response.json();
    return data.data.reply;
  }

  // Call DeepSeek API directly
  async callDeepSeekAPI(apiKey, review) {
    const prompt = `你是一个专业的商家回复助手。请根据以下顾客评论/消息，生成一段专业、友好、有帮助的商家回复。

回复要求：
1. 感谢顾客的反馈
2. 针对评论中的具体问题进行回应
3. 如果是负面评论，表达歉意并说明改进措施
4. 如果是正面评论，表达感谢并邀请再次光临
5. 保持专业和友好的语气
6. 回复长度适中（100-200字）

顾客评论/消息：
${review}

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

  // Show reply dialog for WeChat
  showWeChatReplyDialog(messageItem, originalMessage, reply) {
    // Remove existing dialog
    const existingDialog = document.getElementById('ai-reply-dialog');
    if (existingDialog) existingDialog.remove();

    // Create dialog
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
            <span>AI智能回复</span>
          </div>
          <button class="ai-reply-dialog-close" id="ai-dialog-close">&times;</button>
        </div>
        
        <div class="ai-reply-dialog-body">
          <div class="ai-reply-card">
            <div class="ai-reply-card-label">用户消息</div>
            <div class="ai-reply-card-content">${originalMessage}</div>
          </div>
          
          <div class="ai-reply-card ai-reply-generated">
            <div class="ai-reply-card-label">AI生成回复</div>
            <div class="ai-reply-card-content" id="ai-reply-text">${reply}</div>
          </div>
        </div>
        
        <div class="ai-reply-dialog-footer">
          <button class="ai-reply-btn-secondary" id="ai-reply-regenerate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            重新生成
          </button>
          <button class="ai-reply-btn-primary" id="ai-reply-copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
            </svg>
            复制回复
          </button>
          <button class="ai-reply-btn-primary ai-reply-btn-use" id="ai-reply-use">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            使用回复
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Event listeners
    document.getElementById('ai-dialog-close').addEventListener('click', () => {
      dialog.remove();
    });

    document.getElementById('ai-reply-copy').addEventListener('click', async () => {
      const replyText = document.getElementById('ai-reply-text').textContent;
      await navigator.clipboard.writeText(replyText);
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
    });

    document.getElementById('ai-reply-use').addEventListener('click', () => {
      const replyText = document.getElementById('ai-reply-text').textContent;
      this.insertToWeChat(replyText);
      dialog.remove();
    });

    document.getElementById('ai-reply-regenerate').addEventListener('click', async () => {
      dialog.remove();
      await this.handleWeChatAIReply(messageItem);
    });

    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });
  }

  // Observe WeChat DOM changes
  observeWeChatChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          this.addWeChatReplyButtons();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Add floating action button (for Google/Yelp)
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

    button.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
  }
}

// Initialize content script
new ContentScript();
