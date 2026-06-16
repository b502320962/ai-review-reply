// AI Review Reply - Content Script (WeChat + Google + Yelp)

// ===== WeChat 留言管理页面 =====

class WeChatCommentAI {
  constructor() {
    if (!window.location.href.includes('mp.weixin.qq.com')) return;
    this.init();
  }

  init() {
    this.injectStyles();
    this.addCommentButtons();
    this.observeChanges();
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.action === 'getReview') {
        sendResponse({ review: this.getSelectedText() });
      }
      return true;
    });
  }

  getSelectedText() {
    const sel = window.getSelection().toString().trim();
    if (sel && sel.length > 10) return sel;
    const el = document.querySelector('[class*="content"], [class*="text"]');
    return el ? el.textContent.trim() : null;
  }

  injectStyles() {
    if (document.getElementById('ai-reply-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-reply-styles';
    style.textContent = `
      .ai-reply-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;margin-left:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;transition:all .2s;white-space:nowrap;vertical-align:middle}
      .ai-reply-btn:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 2px 8px rgba(99,102,241,.4)}
      .ai-reply-btn:disabled{opacity:.6;cursor:not-allowed}
      @keyframes ai-spin{to{transform:rotate(360deg)}}
      .ai-spin{animation:ai-spin 1s linear infinite}
      .ai-dialog{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
      .ai-dialog-box{background:#fff;border-radius:12px;width:520px;max-width:90vw;max-height:80vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:ai-dlg-in .2s ease-out}
      @keyframes ai-dlg-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
      .ai-dialog-head{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e5e7eb;background:#f9fafb}
      .ai-dialog-title{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;color:#1f2937}
      .ai-dialog-close{background:none;border:none;font-size:24px;color:#6b7280;cursor:pointer;padding:0;line-height:1}
      .ai-dialog-body{padding:20px;overflow-y:auto;max-height:400px}
      .ai-card{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px}
      .ai-card:last-child{margin-bottom:0}
      .ai-card-label{font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
      .ai-card-text{font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-wrap;word-break:break-word}
      .ai-card-gen{background:#f0f0ff;border-color:#c7d2fe}
      .ai-card-gen .ai-card-label{color:#4f46e5}
      .ai-dialog-foot{display:flex;gap:8px;padding:16px 20px;border-top:1px solid #e5e7eb;background:#f9fafb}
      .ai-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;border:none;flex:1}
      .ai-btn-sec{background:#fff;color:#374151;border:1px solid #d1d5db}
      .ai-btn-sec:hover{background:#f3f4f6}
      .ai-btn-pri{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
      .ai-btn-pri:hover{opacity:.9}
    `;
    document.head.appendChild(style);
  }

  addCommentButtons() {
    // 策略1: 匹配已知类名
    const selectors = ['.comment_item', '.comment-item', '.msg_item', '.message_item'];
    for (const sel of selectors) {
      const items = document.querySelectorAll(sel);
      if (items.length > 0) {
        items.forEach((item) => this.injectButton(item));
        return;
      }
    }

    // 策略2: 查找包含"回复"按钮的操作栏
    document.querySelectorAll('button, [role="button"], span, a').forEach((el) => {
      if (el.textContent.trim() === '回复' || el.getAttribute('title') === '回复') {
        const actionBar = el.parentElement;
        if (actionBar && !actionBar.querySelector('.ai-reply-btn')) {
          const commentItem = actionBar.closest('[class*="comment"], [class*="item"], article, section, div');
          if (commentItem) {
            const btn = this.createButton(commentItem);
            actionBar.appendChild(btn);
          }
        }
      }
    });
  }

  injectButton(item) {
    if (item.querySelector('.ai-reply-btn')) return;
    const actionBar = item.querySelector('[class*="action"], [class*="tool"], [class*="operate"], footer');
    const btn = this.createButton(item);
    if (actionBar) {
      actionBar.appendChild(btn);
    } else {
      const content = item.querySelector('[class*="content"], [class*="text"], p');
      if (content) content.after(btn);
    }
  }

  createButton(commentItem) {
    const btn = document.createElement('button');
    btn.className = 'ai-reply-btn';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>AI回复`;
    btn.title = '使用AI生成回复';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleReply(commentItem, btn);
    });
    return btn;
  }

  async handleReply(commentItem, btn) {
    const contentEl = commentItem.querySelector('[class*="content"], [class*="text"], p');
    const nickEl = commentItem.querySelector('[class*="nick"], [class*="name"], [class*="user"]');
    const commentText = contentEl ? contentEl.textContent.trim() : '';
    const nickname = nickEl ? nickEl.textContent.trim() : '用户';

    if (!commentText) {
      alert('无法获取留言内容');
      return;
    }

    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<svg class="ai-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>生成中...`;
    btn.disabled = true;

    try {
      const { apiKey, mode } = await chrome.storage.local.get(['apiKey', 'mode']);
      let reply;

      if (mode === 'login') {
        const result = await chrome.runtime.sendMessage({ action: 'generateReply', review: commentText });
        if (result.error) throw new Error(result.error);
        reply = result.reply;
      } else if (apiKey) {
        reply = await this.callDeepSeek(apiKey, commentText, nickname);
      } else {
        alert('请先在插件设置中配置 API Key 或登录');
        chrome.runtime.openOptionsPage();
        return;
      }

      this.showDialog(commentItem, nickname, commentText, reply);
    } catch (error) {
      alert('生成回复失败: ' + error.message);
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  async callDeepSeek(apiKey, comment, nickname) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是专业的公众号运营助手，帮助运营者回复读者留言。回复要亲切、有价值。' },
          { role: 'user', content: `你是一个公众号运营者，需要回复读者的留言评论。请根据以下留言内容，生成一段友好、专业、有帮助的回复。\n\n回复要求：\n1. 称呼读者为"${nickname}"\n2. 感谢读者的留言和关注\n3. 针对留言内容进行有价值的回应\n4. 保持亲切、专业的语气\n5. 回复长度适中（50-150字）\n6. 可以适当使用 emoji\n\n读者留言：\n${comment}\n\n请直接给出回复内容，不需要其他说明。` },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('API Key 无效');
      throw new Error(error.error?.message || 'AI 服务请求失败');
    }

    return (await response.json()).choices[0].message.content.trim();
  }

  showDialog(commentItem, nickname, original, reply) {
    const existing = document.getElementById('ai-reply-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'ai-reply-dialog';
    dialog.className = 'ai-dialog';
    dialog.innerHTML = `
      <div class="ai-dialog-box">
        <div class="ai-dialog-head">
          <div class="ai-dialog-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>AI 智能回复</span>
          </div>
          <button class="ai-dialog-close" id="ai-dlg-close">&times;</button>
        </div>
        <div class="ai-dialog-body">
          <div class="ai-card">
            <div class="ai-card-label">👤 ${nickname} 的留言</div>
            <div class="ai-card-text">${original}</div>
          </div>
          <div class="ai-card ai-card-gen">
            <div class="ai-card-label">✨ AI 生成的回复</div>
            <div class="ai-card-text" id="ai-reply-text">${reply}</div>
          </div>
        </div>
        <div class="ai-dialog-foot">
          <button class="ai-btn ai-btn-sec" id="ai-btn-regen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            重新生成
          </button>
          <button class="ai-btn ai-btn-sec" id="ai-btn-copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/></svg>
            复制回复
          </button>
          <button class="ai-btn ai-btn-pri" id="ai-btn-use">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            使用回复
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('ai-dlg-close').onclick = () => dialog.remove();
    document.getElementById('ai-btn-copy').onclick = async () => {
      await navigator.clipboard.writeText(document.getElementById('ai-reply-text').textContent);
      document.getElementById('ai-btn-copy').textContent = '已复制!';
      setTimeout(() => { document.getElementById('ai-btn-copy').textContent = '复制回复'; }, 2000);
    };
    document.getElementById('ai-btn-use').onclick = () => {
      this.insertReply(commentItem, document.getElementById('ai-reply-text').textContent);
      dialog.remove();
    };
    document.getElementById('ai-btn-regen').onclick = () => {
      dialog.remove();
      const btn = commentItem.querySelector('.ai-reply-btn');
      if (btn) btn.click();
    };
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.remove(); });
  }

  insertReply(commentItem, reply) {
    // 在留言项内查找回复框
    const textarea = commentItem.querySelector('textarea, [contenteditable="true"]');
    if (textarea) {
      this.fillText(textarea, reply);
      return;
    }

    // 点击"回复"按钮展开回复框
    const allBtns = commentItem.querySelectorAll('button, [role="button"], span, a');
    for (const btn of allBtns) {
      if (btn.textContent.trim() === '回复' || btn.getAttribute('title') === '回复') {
        btn.click();
        break;
      }
    }

    setTimeout(() => {
      const ta = commentItem.querySelector('textarea, [contenteditable="true"]');
      if (ta) {
        this.fillText(ta, reply);
      } else {
        navigator.clipboard.writeText(reply);
        alert('已复制回复到剪贴板，请手动粘贴到回复框');
      }
    }, 500);
  }

  fillText(el, text) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.focus();
  }

  observeChanges() {
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => this.addCommentButtons(), 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// ===== Google Business / Yelp 浮动按钮 =====

class FloatingButtonAI {
  constructor() {
    const url = window.location.href;
    if (url.includes('mp.weixin.qq.com')) return;
    if (!url.includes('business.google.com') && !url.includes('google.com/business') && !url.includes('yelp.com')) return;
    this.init();
  }

  init() {
    const btn = document.createElement('div');
    btn.id = 'ai-reply-button';
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    btn.title = 'AI Reply';

    const style = document.createElement('style');
    style.textContent = `#ai-reply-button{position:fixed;bottom:20px;right:20px;width:48px;height:48px;background:#6366f1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(99,102,241,.4);z-index:9999;transition:transform .2s,box-shadow .2s}#ai-reply-button:hover{transform:scale(1.1);box-shadow:0 6px 16px rgba(99,102,241,.5)}`;
    document.head.appendChild(style);
    document.body.appendChild(btn);
    btn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openPopup' }));

    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.action === 'getReview') {
        const sel = window.getSelection().toString().trim();
        if (sel && sel.length > 10) { sendResponse({ review: sel }); return true; }
        sendResponse({ review: this.getReviewFromPage() });
      }
      return true;
    });
  }

  getReviewFromPage() {
    const url = window.location.href;
    if (url.includes('business.google.com') || url.includes('google.com/business')) {
      const el = document.querySelector('.review-text, [data-review-text], .ODSEW-ShBeI-text, .review-content');
      return el ? el.textContent.trim() : null;
    }
    if (url.includes('yelp.com')) {
      const el = document.querySelector('.review-content, [data-review-content]');
      return el ? el.textContent.trim() : null;
    }
    return null;
  }
}

// Initialize
new WeChatCommentAI();
new FloatingButtonAI();
