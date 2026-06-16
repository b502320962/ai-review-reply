# AI Review Reply - Supabase 部署指南

## 1. 创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com)，注册/登录
2. 点击 **New Project**
3. 填写项目名称、数据库密码、区域（选择离你最近的）
4. 等待项目创建完成（约 2 分钟）

## 2. 创建数据表

1. 进入项目 → 左侧菜单 **SQL Editor**
2. 点击 **New Query**
3. 粘贴 `supabase/schema.sql` 的内容
4. 点击 **Run** 执行

## 3. 配置 DeepSeek API Key

1. 在 SQL Editor 中执行：
```sql
UPDATE ai_configs SET api_key = '你的DeepSeek API Key' WHERE is_default = true;
```

## 4. 配置 Google 登录

1. 进入 Supabase 项目 → **Authentication** → **Providers**
2. 找到 **Google**，点击启用
3. 填写：
   - **Client ID**: 从 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 获取
   - **Client Secret**: 同上
4. 在 Google Cloud Console 中，确保 OAuth 客户端已添加以下重定向 URI：
   ```
   https://你的项目ID.supabase.co/auth/v1/callback
   ```

## 5. 获取项目配置

1. 进入 Supabase 项目 → **Settings** → **API**
2. 复制以下两个值：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJxxxx...`

## 6. 配置插件

1. 打开 `lib/supabase-client.js`
2. 替换以下两行：
```javascript
const SUPABASE_URL = 'https://你的项目ID.supabase.co';
const SUPABASE_ANON_KEY = '你的anon key';
```

## 7. 部署 Edge Function

1. 安装 [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
# macOS
brew install supabase/tap/supabase

# Windows
scoop install supabase

# Linux
curl -fsSL https://cli.supabase.com/install.sh | sh
```

2. 登录：
```bash
supabase login
```

3. 在项目目录下关联项目：
```bash
cd ai-review-reply
supabase link --project-ref 你的项目ID
```

4. 部署 Edge Function：
```bash
supabase functions deploy generate-reply
```

5. 设置环境变量（DeepSeek API Key）：
```bash
supabase secrets set DEEPSEEK_API_KEY=sk-你的key
```

> **注意**：Edge Function 中的 AI 配置是从数据库 `ai_configs` 表读取的，所以第 3 步已经设置了。

## 8. 加载插件

1. 打开 Chrome → `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `ai-review-reply` 文件夹

## 9. 测试

1. **API Key 模式**：
   - 右键插件图标 → 选项 → 选择「API Key 模式」
   - 输入 DeepSeek API Key → 保存
   - 打开微信公众号后台 → 留言管理 → 点击「AI回复」

2. **登录模式**：
   - 右键插件图标 → 选项 → 选择「登录模式」
   - 点击「使用 Google 登录」
   - 登录后会显示剩余次数（默认 30 次/月）
   - 打开任意支持的页面 → 使用 AI 回复

---

## 常见问题

### Q: Edge Function 调用失败？
A: 检查 Supabase 项目 → Edge Functions → 日志，查看具体错误。

### Q: Google 登录失败？
A: 确保 Google Cloud Console 中的 OAuth 客户端已添加正确的重定向 URI。

### Q: 如何增加用户额度？
A: 在 SQL Editor 中执行：
```sql
UPDATE user_profiles SET credits_total = 100 WHERE id = '用户UUID';
```

### Q: 如何升级为 Pro 用户？
A: 目前需要手动设置：
```sql
UPDATE user_profiles SET plan = 'pro', credits_total = 300 WHERE id = '用户UUID';
```
Stripe 支付集成需要额外配置。
