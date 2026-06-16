// AI Review Reply - Background Service Worker

importScripts('../lib/supabase-client.js');

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
    handleLogout()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getUserInfo') {
    handleGetUserInfo()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Google 登录
async function handleGoogleLogin() {
  const user = await supabase.signInWithGoogle();
  return { success: true, user };
}

// 登出
async function handleLogout() {
  await supabase.signOut();
  return { success: true };
}

// 获取用户信息
async function handleGetUserInfo() {
  const session = await supabase.restoreSession();
  if (!session) return { success: false, user: null };

  const { user } = await chrome.storage.local.get(['user']);
  const profile = await supabase.getUserProfile();

  return {
    success: true,
    user: {
      ...user,
      plan: profile?.plan || 'free',
      creditsTotal: profile?.credits_total || 30,
      creditsUsed: profile?.credits_used || 0,
      creditsRemaining: (profile?.credits_total || 30) - (profile?.credits_used || 0),
    },
  };
}

// 生成回复
async function handleGenerateReply(request) {
  const { review } = request;

  // 获取设置
  const { apiKey, mode } = await chrome.storage.local.get(['apiKey', 'mode']);

  if (mode === 'login') {
    // 通过 Supabase Edge Function
    const data = await supabase.generateReply(review);
    return { reply: data.reply };
  } else if (apiKey) {
    // 直接调用 DeepSeek
    return { reply: await callDeepSeek(apiKey, review) };
  } else {
    throw new Error('请先在设置中配置 API Key 或登录');
  }
}

// 直接调用 DeepSeek API
async function callDeepSeek(apiKey, review) {
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
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是专业的商家回复助手，帮助商家回复顾客评论。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('API Key 无效，请在设置中检查');
    throw new Error(error.error?.message || 'AI 服务请求失败');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
