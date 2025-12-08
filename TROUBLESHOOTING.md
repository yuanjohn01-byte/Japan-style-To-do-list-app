# 🔧 Todo 添加失败问题排查指南

## 问题：点击加号一直转圈，无法保存

### 最可能的原因（按优先级排序）

---

## 1️⃣ 数据库表未创建 ⭐⭐⭐⭐⭐

**症状：** 加号一直转圈，控制台显示 `relation "todos" does not exist`

**原因：** 还没有在 Supabase 中执行 SQL 脚本创建表

**解决方法：**

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧 **SQL Editor**
4. 点击 **New query**
5. 复制 `supabase-schema.sql` 的全部内容
6. 粘贴到编辑器
7. 点击 **Run** 执行

**验证：**
```sql
-- 在 SQL Editor 中运行
SELECT * FROM todos LIMIT 1;
```
如果返回结果（即使是空的），说明表已创建。

---

## 2️⃣ RLS 策略问题 ⭐⭐⭐⭐

**症状：** 控制台显示 `new row violates row-level security policy`

**原因：** RLS 策略配置不正确，或者 user_id 不匹配

**解决方法 A - 检查策略是否创建：**

```sql
-- 在 SQL Editor 中运行
SELECT * FROM pg_policies WHERE tablename = 'todos';
```

应该看到 4 个策略：
- Users can view their own todos
- Users can insert their own todos
- Users can update their own todos
- Users can delete their own todos

**解决方法 B - 重新创建策略：**

如果策略不存在或不正确，重新执行 `supabase-schema.sql`

**解决方法 C - 临时禁用 RLS（仅用于测试）：**

```sql
-- ⚠️ 仅用于测试，不要在生产环境使用
ALTER TABLE todos DISABLE ROW LEVEL SECURITY;
```

如果禁用 RLS 后可以添加，说明是策略问题。

---

## 3️⃣ 用户未正确登录 ⭐⭐⭐

**症状：** 点击加号后被重定向到登录页

**原因：** 用户 session 过期或未登录

**解决方法：**

1. 检查右上角是否显示用户邮箱
2. 如果没有，点击 **Login** 重新登录
3. 登录后再尝试添加 todo

**调试：**

打开浏览器控制台，运行：
```javascript
// 检查当前用户
const { data } = await supabase.auth.getUser();
console.log('Current user:', data.user);
```

---

## 4️⃣ 环境变量配置错误 ⭐⭐

**症状：** 控制台显示 `Invalid API key` 或连接错误

**原因：** `.env.local` 配置不正确

**检查 `.env.local`：**

```bash
cat .env.local
```

应该包含：
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**获取正确的值：**

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目
3. 点击左侧 **Settings** → **API**
4. 复制：
   - Project URL
   - anon/public key

**更新后重启服务器：**
```bash
# 停止服务器（Ctrl+C）
# 重新启动
npm run dev
```

---

## 5️⃣ 网络或 Supabase 连接问题 ⭐

**症状：** 长时间无响应，最后超时

**检查网络：**

```bash
# 测试 Supabase 连接
curl https://your-project.supabase.co/rest/v1/
```

**检查 Supabase 状态：**
访问 [Supabase Status](https://status.supabase.com/)

---

## 🔍 详细诊断步骤

### 步骤 1：打开浏览器开发者工具

1. 按 `F12` 或右键 → 检查
2. 切换到 **Console** 标签
3. 清空控制台（垃圾桶图标）

### 步骤 2：尝试添加 Todo

1. 在输入框输入文字
2. 点击加号按钮
3. 观察控制台输出

### 步骤 3：查看错误信息

**常见错误及解决方法：**

#### 错误 A：`relation "todos" does not exist`
```
❌ Error fetching todos: { message: "relation \"todos\" does not exist" }
```
**解决：** 执行 `supabase-schema.sql` 创建表

#### 错误 B：`new row violates row-level security policy`
```
❌ Error adding todo: { message: "new row violates row-level security policy" }
```
**解决：** 检查 RLS 策略，确保已创建所有 4 个策略

#### 错误 C：`JWT expired`
```
❌ Error: JWT expired
```
**解决：** 重新登录

#### 错误 D：`Invalid API key`
```
❌ Error: Invalid API key
```
**解决：** 检查 `.env.local` 配置

#### 错误 E：`column "user_id" does not exist`
```
❌ Error: column "user_id" does not exist
```
**解决：** 表结构不正确，重新执行 `supabase-schema.sql`

---

## 🧪 快速测试脚本

在浏览器控制台运行以下脚本进行诊断：

```javascript
// 测试脚本
async function diagnoseTodoIssue() {
  console.log('🔍 开始诊断...\n');
  
  // 1. 检查用户登录状态
  console.log('1️⃣ 检查用户登录状态...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('❌ 获取用户失败:', userError);
    return;
  }
  if (!user) {
    console.error('❌ 用户未登录');
    console.log('👉 请先登录');
    return;
  }
  console.log('✅ 用户已登录:', user.email);
  console.log('   User ID:', user.id);
  
  // 2. 检查表是否存在
  console.log('\n2️⃣ 检查 todos 表...');
  const { data: todos, error: fetchError } = await supabase
    .from('todos')
    .select('*')
    .limit(1);
  
  if (fetchError) {
    if (fetchError.message.includes('does not exist')) {
      console.error('❌ todos 表不存在');
      console.log('👉 请在 Supabase Dashboard 执行 supabase-schema.sql');
    } else {
      console.error('❌ 查询失败:', fetchError);
    }
    return;
  }
  console.log('✅ todos 表存在');
  
  // 3. 测试插入
  console.log('\n3️⃣ 测试插入数据...');
  const testTodo = {
    text: '测试 Todo - ' + new Date().toISOString(),
    user_id: user.id,
    completed: false
  };
  
  const { data: newTodo, error: insertError } = await supabase
    .from('todos')
    .insert([testTodo])
    .select()
    .single();
  
  if (insertError) {
    console.error('❌ 插入失败:', insertError);
    if (insertError.message.includes('row-level security')) {
      console.log('👉 RLS 策略问题，请检查策略是否正确创建');
    } else if (insertError.message.includes('column')) {
      console.log('👉 表结构问题，请重新执行 supabase-schema.sql');
    }
    return;
  }
  
  console.log('✅ 插入成功!');
  console.log('   新 Todo:', newTodo);
  
  // 4. 测试删除（清理测试数据）
  console.log('\n4️⃣ 清理测试数据...');
  const { error: deleteError } = await supabase
    .from('todos')
    .delete()
    .eq('id', newTodo.id);
  
  if (deleteError) {
    console.warn('⚠️ 删除测试数据失败:', deleteError);
  } else {
    console.log('✅ 测试数据已清理');
  }
  
  console.log('\n🎉 诊断完成！所有功能正常！');
}

// 运行诊断
diagnoseTodoIssue();
```

---

## 📋 检查清单

在联系支持之前，请确认：

- [ ] 已在 Supabase Dashboard 执行 `supabase-schema.sql`
- [ ] `.env.local` 配置正确（URL 和 API Key）
- [ ] 已重启开发服务器
- [ ] 用户已成功登录（右上角显示邮箱）
- [ ] 浏览器控制台没有错误信息
- [ ] 网络连接正常

---

## 🆘 仍然无法解决？

如果以上方法都无法解决，请提供以下信息：

1. **浏览器控制台的完整错误信息**
2. **运行诊断脚本的输出**
3. **Supabase Dashboard 中的表结构截图**
4. **是否成功执行了 SQL 脚本**

---

## 💡 快速修复（最常见）

90% 的情况是因为表未创建，快速修复：

```sql
-- 在 Supabase SQL Editor 中执行
-- 复制 supabase-schema.sql 的全部内容并运行
```

执行后刷新页面，再次尝试添加 todo。

