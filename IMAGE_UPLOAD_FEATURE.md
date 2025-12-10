# Todo 图片上传功能实现说明

## 功能概述

为 Todo 应用添加了图片上传功能，允许用户在创建待办事项时上传一张图片作为附件。

## 实现的功能

### 1. 数据库字段
- ✅ 在 `supabase-schema.sql` 中添加了 `image_url` 字段（TEXT 类型，可为空）
- ✅ 添加了字段注释说明

### 2. 图片上传
- ✅ 用户可以在添加 Todo 时选择一张图片
- ✅ 图片上传到 Supabase Storage 的 `my-todo` bucket
- ✅ 文件路径格式：`{userId}/{timestamp}-{random}.{ext}`
- ✅ 文件大小限制：5MB
- ✅ 文件类型限制：仅支持图片格式

### 3. 图片预览
- ✅ 选择图片后立即显示预览
- ✅ 可以在提交前取消选择的图片
- ✅ 预览图片尺寸：高度 128px，宽度自适应

### 4. 图片显示
- ✅ 在 Todo 列表中显示图片附件
- ✅ 点击图片可在新标签页中查看原图
- ✅ 鼠标悬停时显示放大效果

### 5. 图片删除
- ✅ 删除 Todo 时自动删除 Storage 中的图片文件
- ✅ 防止存储空间浪费

### 6. 批量添加支持
- ✅ 使用 AI 解析多个待办事项时，图片仅附加到第一条 Todo
- ✅ 在 UI 中提示用户此行为

## 技术实现

### 前端 (`app/page.tsx`)

1. **状态管理**
   - `selectedImage`: 存储用户选择的图片文件
   - `imagePreview`: 存储图片的预览 URL

2. **核心函数**
   - `handleImageSelect()`: 处理图片选择，验证文件类型和大小
   - `clearSelectedImage()`: 清除选中的图片
   - `addTodo()`: 修改为先上传图片，再调用 API 创建 Todo
   - `deleteTodo()`: 修改为删除 Todo 时同时删除 Storage 中的图片

3. **UI 组件**
   - 图片选择按钮（使用 `ImageIcon` 图标）
   - 图片预览区域（带删除按钮）
   - Todo 列表项中的图片展示

### 后端 (`app/api/parse-todos/route.ts`)

1. **API 修改**
   - 接收 `imageUrl` 参数
   - 将图片 URL 保存到第一条解析出的 Todo 中
   - 其他 Todo 的 `image_url` 字段为 `null`

### Storage 功能 (`lib/supabase/storage.ts`)

已有的 Storage 工具函数：
- `uploadTodoImage()`: 上传图片到 my-todo bucket
- `deleteTodoImage()`: 删除图片文件
- `replaceTodoImage()`: 替换图片（先删后传）

## 使用流程

1. 用户在输入框中输入待办事项内容
2. 点击"添加图片附件"按钮选择图片
3. 选择后立即显示预览，可点击 X 按钮取消
4. 点击添加按钮提交
5. 系统先上传图片到 Storage，获取 URL
6. 调用 API 解析待办事项，将图片 URL 保存到第一条
7. 在 Todo 列表中显示带图片的待办事项
8. 点击图片可在新标签页查看原图
9. 删除 Todo 时自动清理 Storage 中的图片

## 注意事项

1. **权限控制**
   - 图片上传路径包含用户 ID，确保文件隔离
   - 删除图片时验证文件路径是否属于当前用户

2. **存储优化**
   - 删除 Todo 时同步删除 Storage 文件
   - 避免孤立文件占用存储空间

3. **用户体验**
   - 图片预览提供即时反馈
   - 上传过程中禁用表单防止重复提交
   - 错误信息清晰明确

4. **批量添加**
   - AI 解析出多条 Todo 时，图片仅附加到第一条
   - UI 中有明确提示说明此行为

## 文件修改清单

- ✅ `supabase-schema.sql` - 添加 image_url 字段
- ✅ `app/page.tsx` - 实现图片上传 UI 和逻辑
- ✅ `app/api/parse-todos/route.ts` - 支持保存图片 URL
- ✅ `lib/supabase/storage.ts` - 已有 Storage 工具函数
- ✅ `lib/supabase/index.ts` - Todo 类型已包含 image_url 字段

## 测试建议

1. 测试图片上传功能
   - 上传不同格式的图片（jpg, png, gif, webp）
   - 上传超过 5MB 的图片（应该被拒绝）
   - 上传非图片文件（应该被拒绝）

2. 测试图片预览
   - 选择图片后查看预览
   - 取消选择的图片
   - 重新选择其他图片

3. 测试批量添加
   - 输入多个待办事项，附加图片
   - 验证只有第一条 Todo 有图片

4. 测试图片删除
   - 删除带图片的 Todo
   - 验证 Storage 中的文件也被删除

5. 测试图片显示
   - 查看 Todo 列表中的图片
   - 点击图片在新标签页查看
   - 验证鼠标悬停效果

## 未来改进建议

1. 支持多张图片附件
2. 支持图片编辑（裁剪、旋转等）
3. 支持拖拽上传
4. 添加图片压缩功能
5. 支持其他文件类型（PDF、文档等）
