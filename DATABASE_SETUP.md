# Supabase 数据库设置指南

## 📋 概述

这个文档说明如何为 Todo List 应用设置 Supabase 数据库，包括表结构和行级安全策略 (RLS)。

## 🗄️ 数据库表结构

### `todos` 表

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | UUID | 主键，自动生成 | PRIMARY KEY |
| `user_id` | UUID | 用户ID，关联到 auth.users | NOT NULL, FOREIGN KEY |
| `text` | TEXT | 待办事项内容 | NOT NULL, 1-500字符 |
| `completed` | BOOLEAN | 是否完成 | NOT NULL, 默认 false |
| `created_at` | TIMESTAMPTZ | 创建时间 | NOT NULL, 自动生成 |
| `updated_at` | TIMESTAMPTZ | 更新时间 | NOT NULL, 自动更新 |

## 🔒 安全策略 (RLS Policies)

### 1. **查看策略** - `Users can view their own todos`
- 用户只能查看自己创建的 todos
- 条件：`auth.uid() = user_id`

### 2. **创建策略** - `Users can insert their own todos`
- 用户只能创建属于自己的 todos
- 条件：`auth.uid() = user_id`

### 3. **更新策略** - `Users can update their own todos`
- 用户只能更新自己的 todos
- 条件：`auth.uid() = user_id`

### 4. **删除策略** - `Users can delete their own todos`
- 用户只能删除自己的 todos
- 条件：`auth.uid() = user_id`

## 🚀 部署步骤

### 方法 1：通过 Supabase Dashboard (推荐)

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New query**
5. 复制 `supabase-schema.sql` 的内容并粘贴
6. 点击 **Run** 执行 SQL

### 方法 2：使用 Supabase CLI

```bash
# 确保已安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接到你的项目
supabase link --project-ref your-project-ref

# 执行 SQL 文件
supabase db push
```

## ✅ 验证安装

### 1. 检查表是否创建成功

在 SQL Editor 中运行：

```sql
SELECT * FROM todos LIMIT 1;
```

### 2. 检查 RLS 是否启用

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'todos';
```

应该返回 `rowsecurity = true`

### 3. 查看所有策略

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'todos';
```

应该看到 4 个策略：
- Users can view their own todos
- Users can insert their own todos
- Users can update their own todos
- Users can delete their own todos

## 🧪 测试 RLS 策略

### 测试 1：未登录用户无法访问

```sql
-- 设置为匿名用户
SET LOCAL role TO anon;

-- 尝试查询（应该返回空结果）
SELECT * FROM todos;
```

### 测试 2：登录用户只能看到自己的数据

```sql
-- 重置角色
RESET role;

-- 以特定用户身份查询
SELECT * FROM todos WHERE user_id = auth.uid();
```

## 📊 索引说明

为了提高查询性能，创建了以下索引：

1. `todos_user_id_idx` - 按用户ID查询
2. `todos_created_at_idx` - 按创建时间排序
3. `todos_user_id_created_at_idx` - 组合索引，用户+时间
4. `todos_user_id_completed_idx` - 组合索引，用户+完成状态

## 🔄 自动更新 `updated_at`

创建了触发器 `update_todos_updated_at`，每次更新记录时自动更新 `updated_at` 字段。

## 🔧 前端代码更新

### TypeScript 类型定义

```typescript
export interface Todo {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}
```

### 创建 Todo 时包含 user_id

```typescript
const { data, error } = await supabase
  .from('todos')
  .insert([{ 
    text: newTodo.trim(),
    user_id: user.id 
  }])
  .select()
  .single();
```

## 🛡️ 安全特性

1. **行级安全 (RLS)** - 每个用户只能访问自己的数据
2. **外键约束** - 确保 user_id 必须存在于 auth.users 表中
3. **级联删除** - 当用户被删除时，其所有 todos 也会被删除
4. **字符长度限制** - text 字段限制 1-500 字符
5. **非空约束** - 关键字段不能为空

## 📝 常见问题

### Q: 为什么我看不到任何 todos？
A: 确保你已经登录，RLS 策略会过滤掉不属于你的数据。

### Q: 插入数据时报错 "new row violates row-level security policy"
A: 确保在插入时包含了正确的 `user_id`，且该 ID 与当前登录用户匹配。

### Q: 如何查看所有用户的 todos（管理员）？
A: 需要创建额外的策略或使用 service role key（谨慎使用）。

## 🔗 相关资源

- [Supabase RLS 文档](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS 文档](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)

## 📞 支持

如有问题，请查看：
- Supabase 官方文档
- GitHub Issues
- Supabase Discord 社区

