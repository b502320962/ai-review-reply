// AI Review Reply - Supabase Client
// 通过 Supabase REST API 通信，无需引入 SDK

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // 替换为你的 Supabase 项目 URL
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'; // 替换为你的 Supabase anon key

class SupabaseClient {
  constructor() {
    this.url = SUPABASE_URL;
    this.anonKey = SUPABASE_ANON_KEY;
    this.accessToken = null;
  }

  // 获取请求头
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.anonKey,
    };
    if (includeAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  // Google 登录（通过 chrome.identity 获取 token，然后交换 Supabase session）
  async signInWithGoogle() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!token) {
          reject(new Error('Failed to get Google token'));
          return;
        }

        try {
          // 用 Google token 换取 Supabase session
          const response = await fetch(`${this.url}/auth/v1/token?grant_type=id_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.anonKey,
            },
            body: JSON.stringify({
              provider: 'google',
              id_token: token,
            }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.msg || error.message || 'Login failed');
          }

          const data = await response.json();
          this.accessToken = data.access_token;

          // 保存到 storage
          await chrome.storage.local.set({
            supabaseSession: {
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              expires_at: Date.now() + data.expires_in * 1000,
            },
            user: {
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
              avatar: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
            },
            mode: 'login',
          });

          resolve({
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
            avatar: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // 恢复 session（从 storage 加载）
  async restoreSession() {
    const result = await chrome.storage.local.get(['supabaseSession']);
    const session = result.supabaseSession;

    if (!session) return null;

    // 检查是否过期
    if (session.expires_at && Date.now() > session.expires_at) {
      // 尝试刷新 token
      try {
        await this.refreshSession(session.refresh_token);
      } catch {
        await this.signOut();
        return null;
      }
    } else {
      this.accessToken = session.access_token;
    }

    return this.accessToken;
  }

  // 刷新 session
  async refreshSession(refreshToken) {
    const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.anonKey,
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh session');
    }

    const data = await response.json();
    this.accessToken = data.access_token;

    await chrome.storage.local.set({
      supabaseSession: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      },
    });
  }

  // 登出
  async signOut() {
    this.accessToken = null;
    await chrome.storage.local.remove(['supabaseSession', 'user', 'mode']);
  }

  // 获取用户 profile（包含额度信息）
  async getUserProfile() {
    if (!this.accessToken) {
      await this.restoreSession();
    }
    if (!this.accessToken) return null;

    const response = await fetch(
      `${this.url}/rest/v1/user_profiles?select=*&id=eq.${await this.getUserId()}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) return null;

    const profiles = await response.json();
    return profiles[0] || null;
  }

  // 获取用户 ID
  async getUserId() {
    const result = await chrome.storage.local.get(['user']);
    return result.user?.id;
  }

  // 调用 Edge Function 生成回复
  async generateReply(review, tone = 'professional', platform = 'google') {
    if (!this.accessToken) {
      await this.restoreSession();
    }
    if (!this.accessToken) {
      throw new Error('Please login first');
    }

    const response = await fetch(`${this.url}/functions/v1/generate-reply`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ review, tone, platform }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === 'NO_CREDITS') {
        throw new Error('免费额度已用完，请升级 Pro 或使用 API Key 模式');
      }
      throw new Error(data.message || 'Failed to generate reply');
    }

    // 更新本地额度缓存
    if (data.data?.creditsRemaining !== undefined) {
      const { user } = await chrome.storage.local.get(['user']);
      if (user) {
        user.creditsRemaining = data.data.creditsRemaining;
        await chrome.storage.local.set({ user });
      }
    }

    return data.data;
  }
}

// 全局实例
const supabase = new SupabaseClient();
