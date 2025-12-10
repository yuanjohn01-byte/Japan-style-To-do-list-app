-- ============================================
-- Todos Table Schema with RLS Policies
-- ============================================
-- 
-- 功能说明：
-- 1. 每个用户只能看到和操作自己的 todos
-- 2. 必须登录才能创建、读取、更新、删除 todos
-- 3. 使用 UUID 作为主键
-- 4. 自动记录创建和更新时间
-- ============================================

-- 删除已存在的表（如果需要重新创建）
-- DROP TABLE IF EXISTS todos CASCADE;

-- 创建 todos 表
CREATE TABLE IF NOT EXISTS todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 500),
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 添加表注释
COMMENT ON TABLE todos IS '用户待办事项表';
COMMENT ON COLUMN todos.id IS '待办事项唯一标识';
COMMENT ON COLUMN todos.user_id IS '所属用户ID，关联到 auth.users';
COMMENT ON COLUMN todos.text IS '待办事项内容，最多500字符';
COMMENT ON COLUMN todos.completed IS '是否已完成';
COMMENT ON COLUMN todos.image_url IS '附件图片的预览地址';
COMMENT ON COLUMN todos.created_at IS '创建时间';
COMMENT ON COLUMN todos.updated_at IS '最后更新时间';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos(created_at DESC);
CREATE INDEX IF NOT EXISTS todos_user_id_created_at_idx ON todos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS todos_user_id_completed_idx ON todos(user_id, completed);

-- 启用行级安全策略 (RLS)
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own todos" ON todos;
DROP POLICY IF EXISTS "Users can insert their own todos" ON todos;
DROP POLICY IF EXISTS "Users can update their own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete their own todos" ON todos;

-- ============================================
-- RLS 策略：用户只能查看自己的 todos
-- ============================================
CREATE POLICY "Users can view their own todos"
  ON todos
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- RLS 策略：用户只能创建自己的 todos
-- ============================================
CREATE POLICY "Users can insert their own todos"
  ON todos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS 策略：用户只能更新自己的 todos
-- ============================================
CREATE POLICY "Users can update their own todos"
  ON todos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS 策略：用户只能删除自己的 todos
-- ============================================
CREATE POLICY "Users can delete their own todos"
  ON todos
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 创建触发器：自动更新 updated_at 字段
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_todos_updated_at ON todos;

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 验证 RLS 策略是否生效（可选）
-- ============================================
-- 查看表的 RLS 状态
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'todos';

-- 查看所有策略
-- SELECT * FROM pg_policies WHERE tablename = 'todos';
