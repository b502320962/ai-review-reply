-- AI Review Reply - Supabase Database Schema
-- 在 Supabase SQL Editor 中执行此文件

-- 1. 用户使用日志表（Supabase Auth 自动管理 users 表）
CREATE TABLE IF NOT EXISTS usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'google',
  tone TEXT DEFAULT 'professional',
  review_text TEXT,
  reply_text TEXT,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AI 配置表
CREATE TABLE IF NOT EXISTS ai_configs (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'deepseek',
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  api_key TEXT NOT NULL,
  api_url TEXT NOT NULL DEFAULT 'https://api.deepseek.com/v1/chat/completions',
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 平台配置表
CREATE TABLE IF NOT EXISTS platform_configs (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 用户配置扩展表（Supabase Auth 不支持自定义字段，用 user_metadata 代替）
-- 这个表用于存储额外的用户信息
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro')),
  credits_total INTEGER DEFAULT 30,
  credits_used INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'none',
  subscription_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);

-- 插入默认 AI 配置
INSERT INTO ai_configs (provider, model, api_key, api_url, is_default)
VALUES ('deepseek', 'deepseek-chat', 'YOUR_DEEPSEEK_API_KEY', 'https://api.deepseek.com/v1/chat/completions', true)
ON CONFLICT DO NOTHING;

-- 插入默认平台配置
INSERT INTO platform_configs (platform, enabled) VALUES ('google', true) ON CONFLICT (platform) DO NOTHING;
INSERT INTO platform_configs (platform, enabled) VALUES ('yelp', true) ON CONFLICT (platform) DO NOTHING;
INSERT INTO platform_configs (platform, enabled) VALUES ('wechat', true) ON CONFLICT (platform) DO NOTHING;

-- RLS (Row Level Security) 策略
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的使用日志
CREATE POLICY "Users can view own usage logs" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage logs" ON usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能查看/更新自己的 profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 自动创建 user_profiles 的触发器
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, plan, credits_total, credits_used)
  VALUES (NEW.id, 'free', 30, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
