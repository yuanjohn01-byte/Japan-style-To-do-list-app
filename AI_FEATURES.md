# 🤖 AI 智能解析待办事项功能

## ✨ 功能概述

使用 DeepSeek AI 模型智能解析用户输入的文本，自动提取并创建待办事项。

### 主要特性

1. **智能文本解析** - AI 自动识别文本中的所有任务
2. **批量创建** - 一次输入多个任务，自动分别创建
3. **多行输入** - 支持更长的文本描述（最多 2000 字符）
4. **后端处理** - 使用服务端 API 安全地操作数据库

## 🚀 使用方法

### 1. 配置环境变量

在 `.env.local` 文件中添加以下配置：

```env
# Supabase Service Role Key（从 Dashboard > Settings > API 获取）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI API 配置
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.deepseek.com
```

### 2. 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
npm run dev
```

### 3. 使用 AI 功能

在输入框中输入你的待办事项描述：

**单个任务示例：**
```
明天要买菜
```
→ AI 会创建：`买菜`

**多个任务示例：**
```
明天要开会，然后写报告，还要给客户打电话
```
→ AI 会创建：
- `开会`
- `写报告`
- `给客户打电话`

**复杂描述示例：**
```
这周需要完成以下工作：
1. 完成项目文档
2. 准备周五的演示
3. 回复客户邮件
4. 更新代码仓库
```
→ AI 会智能提取所有任务

## 🏗️ 技术架构

### 前端 (`app/page.tsx`)

```typescript
// 多行文本输入框（3行）
<textarea
  rows={3}
  placeholder="描述你的待办事项，AI 会帮你智能解析..."
/>

// 调用后端 API
const response = await fetch('/api/parse-todos', {
  method: 'POST',
  body: JSON.stringify({
    text: todoText,
    userId: user.id,
  }),
});
```

### 后端 API (`app/api/parse-todos/route.ts`)

```typescript
// 1. 接收用户输入
const { text, userId } = await request.json();

// 2. 调用 DeepSeek AI 解析
const completion = await openai.chat.completions.create({
  model: 'deepseek-chat',
  messages: [
    { role: 'system', content: '待办事项解析规则...' },
    { role: 'user', content: text },
  ],
  response_format: { type: 'json_object' },
});

// 3. 解析 AI 返回的 JSON
const parsedTodos = JSON.parse(aiResponse);

// 4. 使用 Service Role Key 插入数据库（绕过 RLS）
const { data } = await supabaseAdmin
  .from('todos')
  .insert(todosToInsert);
```

## 🔒 安全机制

### 1. 服务端 API Key

使用 `SUPABASE_SERVICE_ROLE_KEY` 在后端操作数据库：

```typescript
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 服务端密钥
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

**优势：**
- ✅ 绕过 RLS 策略，后端可以代表用户插入数据
- ✅ 密钥只在服务端使用，不会暴露到客户端
- ✅ 前端传递 `userId`，后端验证并使用

### 2. 输入验证

```typescript
// 验证必要参数
if (!text || !userId) {
  return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
}

// 限制文本长度
if (text.length > 2000) {
  return NextResponse.json({ error: '文本过长' }, { status: 400 });
}

// 限制每个 todo 长度
text: todoText.substring(0, 500)
```

### 3. 错误处理

```typescript
try {
  // AI 调用
  // 数据库操作
} catch (error) {
  // 网络错误
  if (error.code === 'ENOTFOUND') {
    return NextResponse.json({ error: 'AI 服务连接失败' }, { status: 503 });
  }
  
  // 认证错误
  if (error.status === 401) {
    return NextResponse.json({ error: 'API 密钥无效' }, { status: 401 });
  }
  
  // 通用错误
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

## 📊 AI Prompt 设计

### System Prompt

```
你是一个专业的待办事项助手。用户会给你一段文字，你需要从中提取所有的待办事项。

规则：
1. 识别文本中所有需要完成的任务、事项、计划
2. 每个待办事项应该简洁明确，一句话描述
3. 如果文本中有多个任务，提取所有任务
4. 如果只有一个任务，返回一个任务
5. 如果文本中没有明确的待办事项，尝试理解用户意图并创建合理的待办事项
6. 返回 JSON 格式：{ "todos": ["任务1", "任务2", ...] }
7. 只返回 JSON，不要有其他文字
```

### 响应格式

```json
{
  "todos": [
    "任务1",
    "任务2",
    "任务3"
  ]
}
```

### 模型配置

```typescript
{
  model: 'deepseek-chat',
  temperature: 0.3,  // 较低温度，保持一致性
  response_format: { type: 'json_object' }  // 强制 JSON 输出
}
```

## 🧪 测试用例

### 测试 1：单个任务
**输入：** `买菜`  
**预期输出：** 1 个 todo - "买菜"

### 测试 2：多个任务
**输入：** `明天要开会，写报告，打电话`  
**预期输出：** 3 个 todos
- "开会"
- "写报告"
- "打电话"

### 测试 3：复杂描述
**输入：**
```
这周的工作安排：
1. 周一开项目启动会
2. 周三前完成需求文档
3. 周五下午演示 demo
```
**预期输出：** 3 个 todos
- "开项目启动会"
- "完成需求文档"
- "演示 demo"

### 测试 4：自然语言
**输入：** `我需要准备明天的会议材料，还要回复客户的邮件`  
**预期输出：** 2 个 todos
- "准备明天的会议材料"
- "回复客户的邮件"

## 🐛 常见问题

### Q1: AI 解析失败
**错误：** `AI 服务连接失败`

**可能原因：**
- OPENAI_API_KEY 未配置
- OPENAI_BASE_URL 不正确
- 网络连接问题

**解决方法：**
```bash
# 检查环境变量
echo $OPENAI_API_KEY
echo $OPENAI_BASE_URL

# 测试 API 连接
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'
```

### Q2: 数据库插入失败
**错误：** `数据库插入失败`

**可能原因：**
- SUPABASE_SERVICE_ROLE_KEY 未配置或不正确
- 数据库表不存在

**解决方法：**
```sql
-- 检查表是否存在
SELECT * FROM todos LIMIT 1;

-- 检查 Service Role Key
-- 在 Supabase Dashboard > Settings > API > service_role
```

### Q3: 未能提取待办事项
**错误：** `未能从文本中提取出待办事项`

**可能原因：**
- 输入文本过于模糊
- AI 无法理解意图

**解决方法：**
- 使用更明确的描述
- 包含动词（做、完成、准备等）
- 示例：`需要做的事：买菜、写报告`

## 📈 性能优化

### 1. 缓存策略
```typescript
// 可以添加缓存避免重复解析相同文本
const cacheKey = `parse:${hash(text)}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;
```

### 2. 批量插入
```typescript
// 当前已实现批量插入
const { data } = await supabaseAdmin
  .from('todos')
  .insert(todosToInsert);  // 一次插入多条
```

### 3. 异步处理
```typescript
// 对于大量任务，可以考虑后台队列
// 当前同步处理，适合少量任务（< 10个）
```

## 🔧 开发调试

### 查看 AI 响应

```typescript
console.log('🤖 AI 响应:', aiResponse);
console.log('✅ 解析出的待办事项:', parsedTodos.todos);
```

### 查看 API 日志

```bash
# 开发服务器会显示详细日志
📝 开始解析待办事项...
用户ID: xxx
输入文本: xxx
🤖 AI 响应: {"todos":["任务1","任务2"]}
✅ 解析出的待办事项: ["任务1","任务2"]
✅ 成功插入 2 条待办事项
```

### 测试 API

```bash
curl -X POST http://localhost:3000/api/parse-todos \
  -H "Content-Type: application/json" \
  -d '{
    "text": "明天要开会和写报告",
    "userId": "your-user-id"
  }'
```

## 📚 相关资源

- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [DeepSeek API 文档](https://platform.deepseek.com/docs)
- [Supabase Service Role](https://supabase.com/docs/guides/api/api-keys)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

## 🎉 总结

现在你的 Todo List 应用具备了 AI 智能解析功能：

- ✅ 多行文本输入（3行）
- ✅ AI 智能解析待办事项
- ✅ 批量创建支持
- ✅ 后端安全处理
- ✅ 使用 DeepSeek Chat 模型
- ✅ OpenAI Node.js SDK
- ✅ 完善的错误处理

享受 AI 驱动的待办事项管理体验！🚀



