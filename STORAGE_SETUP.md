# Supabase Storage 配置指南

## 📦 Storage Bucket 设置

### 前提条件
- 已在 Supabase Dashboard 创建名为 `my-todo` 的 bucket
- Bucket 必须设置为 **Public**（公开访问）

---

## 🔧 配置步骤

### 1. 创建 Bucket（如果还没有）

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧 **Storage**
4. 点击 **New bucket**
5. 输入名称：`my-todo`
6. 选择 **Public bucket**（允许公开访问）
7. 点击 **Create bucket**

### 2. 配置 Storage 权限策略（RLS）

在 Supabase Dashboard 的 **Storage** → **Policies** 中，为 `my-todo` bucket 创建以下策略：

#### 策略 1：允许用户上传到自己的目录

```sql
-- 策略名称: Users can upload to their own folder
-- 操作: INSERT
-- 目标: my-todo bucket

CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'my-todo' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**说明：**
- 只有登录用户可以上传
- 只能上传到以自己 user_id 命名的文件夹
- 路径格式：`{user_id}/{filename}`

#### 策略 2：允许用户查看自己的文件

```sql
-- 策略名称: Users can view their own files
-- 操作: SELECT
-- 目标: my-todo bucket

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'my-todo' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**说明：**
- 用户只能查看自己文件夹中的文件
- 确保数据隔离

#### 策略 3：允许用户删除自己的文件

```sql
-- 策略名称: Users can delete their own files
-- 操作: DELETE
-- 目标: my-todo bucket

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'my-todo' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**说明：**
- 用户只能删除自己上传的文件
- 防止误删其他用户的文件

#### 策略 4：允许公开读取（可选）

如果 bucket 是 Public 的，这个策略允许任何人通过 URL 访问图片：

```sql
-- 策略名称: Public access for all files
-- 操作: SELECT
-- 目标: my-todo bucket

CREATE POLICY "Public access for all files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'my-todo');
```

**说明：**
- 允许通过公开 URL 访问图片
- 适用于分享 todo 的场景

---

## 📋 完整 SQL 脚本

在 Supabase SQL Editor 中执行以下脚本：

```sql
-- ============================================
-- Storage Policies for my-todo bucket
-- ============================================

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public access for all files" ON storage.objects;

-- 1. 允许用户上传到自己的文件夹
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'my-todo' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. 允许用户查看自己的文件
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'my-todo' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. 允许用户删除自己的文件
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'my-todo' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. 允许公开访问（用于预览图片）
CREATE POLICY "Public access for all files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'my-todo');
```

---

## 🧪 测试 Storage 功能

### 1. 测试上传

在浏览器控制台运行：

```javascript
async function testUpload() {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('User ID:', user?.id);
  
  // 创建测试文件
  const testBlob = new Blob(['test'], { type: 'text/plain' });
  const testFile = new File([testBlob], 'test.txt');
  
  // 上传
  const { data, error } = await supabase.storage
    .from('my-todo')
    .upload(`${user.id}/test-${Date.now()}.txt`, testFile);
  
  if (error) {
    console.error('❌ 上传失败:', error);
  } else {
    console.log('✅ 上传成功:', data);
  }
}

testUpload();
```

### 2. 测试获取 URL

```javascript
async function testGetUrl() {
  const { data: { user } } = await supabase.auth.getUser();
  
  // 获取公开 URL
  const { data } = supabase.storage
    .from('my-todo')
    .getPublicUrl(`${user.id}/test.txt`);
  
  console.log('Public URL:', data.publicUrl);
}

testGetUrl();
```

### 3. 测试删除

```javascript
async function testDelete() {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase.storage
    .from('my-todo')
    .remove([`${user.id}/test.txt`]);
  
  if (error) {
    console.error('❌ 删除失败:', error);
  } else {
    console.log('✅ 删除成功');
  }
}

testDelete();
```

---

## 📂 文件结构

上传的文件按用户组织：

```
my-todo/
├── {user-id-1}/
│   ├── 1234567890-abc123.jpg
│   ├── 1234567891-def456.png
│   └── ...
├── {user-id-2}/
│   ├── 1234567892-ghi789.jpg
│   └── ...
└── ...
```

**优点：**
- 数据隔离
- 易于管理
- 便于批量删除用户数据

---

## 🔒 安全最佳实践

### 1. 文件大小限制

在前端限制文件大小（已实现）：

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
if (file.size > MAX_FILE_SIZE) {
  return { url: null, error: '图片大小不能超过 5MB' };
}
```

### 2. 文件类型验证

只允许图片类型（已实现）：

```typescript
if (!file.type.startsWith('image/')) {
  return { url: null, error: '只能上传图片文件' };
}
```

### 3. 文件名唯一性

使用时间戳 + 随机字符串（已实现）：

```typescript
const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
```

### 4. 路径验证

确保用户只能访问自己的文件夹：

```typescript
if (!filePath.startsWith(userId)) {
  return { success: false, error: '无权删除此图片' };
}
```

---

## 🐛 常见问题

### Q1: 上传失败 "new row violates row-level security policy"

**原因：** Storage RLS 策略未正确配置

**解决：**
1. 检查 bucket 是否存在
2. 确认 bucket 名称是 `my-todo`
3. 执行上面的 SQL 脚本创建策略

### Q2: 无法获取图片 URL

**原因：** Bucket 不是 Public 的

**解决：**
1. 进入 Storage → my-todo
2. 点击设置图标
3. 选择 "Make public"

### Q3: 图片上传后无法显示

**原因：** 可能是 CORS 问题或 URL 格式错误

**解决：**
1. 检查返回的 URL 格式
2. 在浏览器中直接访问 URL 测试
3. 检查浏览器控制台的错误信息

### Q4: 删除 todo 后图片仍然存在

**原因：** 这是正常的，我们在代码中已处理

**说明：**
- 删除 todo 时会自动删除关联的图片
- 如果删除失败，图片会保留（安全机制）

---

## 📊 存储配额

Supabase 免费计划限制：
- **存储空间：** 1GB
- **带宽：** 2GB/月
- **文件上传大小：** 50MB

建议：
- 限制单个文件大小（已设置为 5MB）
- 定期清理未使用的图片
- 升级到付费计划获得更多配额

---

## 🔗 相关文档

- [Supabase Storage 文档](https://supabase.com/docs/guides/storage)
- [Storage RLS 策略](https://supabase.com/docs/guides/storage/security/access-control)
- [文件上传最佳实践](https://supabase.com/docs/guides/storage/uploads)

---

## ✅ 配置检查清单

在使用图片上传功能前，请确认：

- [ ] 已创建 `my-todo` bucket
- [ ] Bucket 设置为 Public
- [ ] 已执行 Storage RLS 策略 SQL
- [ ] 已更新数据库表添加 `image_url` 字段
- [ ] 用户已登录
- [ ] 测试上传功能正常

完成以上步骤后，图片上传功能即可正常使用！🎉

