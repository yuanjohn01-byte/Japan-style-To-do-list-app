# Supabase Realtime 实时同步配置指南

## 🔴 功能说明

Realtime 功能允许多个设备之间实时同步数据变化：
- ✅ 用户在设备 A 添加 todo → 设备 B 自动显示
- ✅ 用户在设备 A 完成 todo → 设备 B 自动更新状态
- ✅ 用户在设备 A 删除 todo → 设备 B 自动移除

---

## 📋 配置步骤

### 1. 启用 Realtime 功能

在 Supabase Dashboard 中启用 Realtime：

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧 **Database** → **Replication**
4. 找到 `todos` 表
5. 打开 **Realtime** 开关

或者在 SQL Editor 中执行：

```sql
-- 启用 todos 表的 Realtime 功能
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
```

### 2. 验证 Realtime 是否启用

在 SQL Editor 中运行：

```sql
-- 查看哪些表启用了 Realtime
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

应该看到 `todos` 表在列表中。

---

## 🔧 代码实现

### 1. 订阅 Realtime 事件

```typescript
useEffect(() => {
  if (!user) return;

  // 订阅 todos 表的变化
  const channel = supabase
    .channel('todos-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // 监听所有事件
        schema: 'public',
        table: 'todos',
        filter: `user_id=eq.${user.id}` // 只监听当前用户的数据
      },
      (payload) => {
        handleRealtimeEvent(payload);
      }
    )
    .subscribe();

  // 清理订阅
  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);
```

### 2. 处理不同类型的事件

```typescript
const handleRealtimeEvent = (payload: any) => {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  switch (eventType) {
    case 'INSERT':
      // 新增 todo
      setTodos((current) => {
        if (current.some(todo => todo.id === newRecord.id)) {
          return current; // 避免重复
        }
        return [newRecord, ...current];
      });
      break;

    case 'UPDATE':
      // 更新 todo
      setTodos((current) =>
        current.map((todo) =>
          todo.id === newRecord.id ? newRecord : todo
        )
      );
      break;

    case 'DELETE':
      // 删除 todo
      setTodos((current) =>
        current.filter((todo) => todo.id !== oldRecord.id)
      );
      break;
  }
};
```

---

## 🎯 工作原理

### 数据流程图

```
设备 A                    Supabase                    设备 B
  │                          │                          │
  │  1. 添加 todo            │                          │
  ├─────────────────────────>│                          │
  │                          │                          │
  │  2. 乐观更新 UI          │  3. 广播 INSERT 事件    │
  │  (立即显示)              ├─────────────────────────>│
  │                          │                          │
  │                          │  4. 接收事件并更新 UI   │
  │                          │  (自动显示)              │
  │                          │                          │
```

### 事件类型

| 事件类型 | 触发时机 | payload 内容 |
|---------|---------|-------------|
| `INSERT` | 新增记录 | `new`: 新记录的完整数据 |
| `UPDATE` | 更新记录 | `new`: 更新后的数据<br>`old`: 更新前的数据 |
| `DELETE` | 删除记录 | `old`: 被删除的记录数据 |

---

## 🔒 安全机制

### 1. 用户数据隔离

使用 `filter` 参数确保只接收当前用户的数据：

```typescript
filter: `user_id=eq.${user.id}`
```

**优点：**
- 不会收到其他用户的数据变化
- 减少网络流量
- 提高性能

### 2. RLS 策略保护

即使 Realtime 广播了数据，RLS 策略也会在数据库层面过滤：

```sql
-- 用户只能查看自己的 todos
CREATE POLICY "Users can view their own todos"
ON todos FOR SELECT
USING (auth.uid() = user_id);
```

**双重保护：**
- Realtime filter（应用层）
- RLS 策略（数据库层）

---

## ⚡ 性能优化

### 1. 避免重复更新

在乐观更新时检查是否已存在：

```typescript
setTodos((current) => {
  // 检查是否已存在
  if (current.some(todo => todo.id === newRecord.id)) {
    return current; // 不重复添加
  }
  return [newRecord, ...current];
});
```

### 2. 使用函数式更新

使用 `setState` 的函数形式，确保基于最新状态：

```typescript
// ✅ 好的做法
setTodos((current) => [...current, newTodo]);

// ❌ 不好的做法
setTodos([...todos, newTodo]); // 可能基于旧状态
```

### 3. 清理订阅

组件卸载时清理订阅，避免内存泄漏：

```typescript
return () => {
  supabase.removeChannel(channel);
};
```

---

## 🧪 测试 Realtime 功能

### 测试场景 1：跨设备同步

1. 在浏览器 A 登录用户账号
2. 在浏览器 B（或无痕模式）登录同一账号
3. 在浏览器 A 添加 todo
4. 观察浏览器 B 是否自动显示新 todo

### 测试场景 2：多种操作

1. 打开两个浏览器窗口
2. 在窗口 A 执行：
   - 添加 todo
   - 完成 todo
   - 删除 todo
3. 观察窗口 B 是否实时同步

### 测试场景 3：网络断开重连

1. 打开浏览器开发者工具
2. 切换到 Network 标签
3. 选择 "Offline" 模式
4. 尝试操作（会失败）
5. 恢复网络
6. 刷新页面，数据应该同步

### 调试工具

在浏览器控制台查看 Realtime 日志：

```javascript
// 查看订阅状态
console.log('Realtime channels:', supabase.getChannels());

// 查看连接状态
supabase.channel('todos-changes').subscribe((status) => {
  console.log('Subscription status:', status);
});
```

---

## 🐛 常见问题

### Q1: Realtime 不工作

**可能原因：**
1. 未启用 Realtime 功能
2. 表未添加到 publication
3. RLS 策略阻止

**解决方法：**

```sql
-- 检查 Realtime 是否启用
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'todos';

-- 如果没有结果，执行：
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
```

### Q2: 收到其他用户的数据

**原因：** filter 参数未正确设置

**解决：**

```typescript
// 确保添加 filter
filter: `user_id=eq.${user.id}`
```

### Q3: 数据重复显示

**原因：** 乐观更新 + Realtime 事件都添加了数据

**解决：** 在添加前检查是否已存在（已实现）

```typescript
if (current.some(todo => todo.id === newRecord.id)) {
  return current;
}
```

### Q4: 订阅状态一直是 PENDING

**可能原因：**
- 网络问题
- Supabase 服务异常
- 认证 token 过期

**解决：**
1. 检查网络连接
2. 重新登录
3. 查看 Supabase Status

### Q5: 本地操作后有闪烁

**原因：** 乐观更新和 Realtime 更新时机不同

**解决：** 使用函数式更新，确保状态一致性（已实现）

---

## 📊 Realtime 限制

### 免费计划限制

- **并发连接：** 200 个
- **消息大小：** 250KB
- **消息速率：** 无限制

### 付费计划

- **并发连接：** 500+ 个
- **消息大小：** 更大
- **优先级支持**

---

## 🔍 调试技巧

### 1. 启用详细日志

```typescript
const channel = supabase
  .channel('todos-changes', {
    config: {
      broadcast: { self: true }
    }
  })
  .on('postgres_changes', { ... }, (payload) => {
    console.log('📡 Realtime event:', payload);
  })
  .subscribe((status, err) => {
    console.log('🔴 Subscription status:', status);
    if (err) console.error('❌ Subscription error:', err);
  });
```

### 2. 监控连接状态

```typescript
channel.on('system', {}, (payload) => {
  console.log('System event:', payload);
});
```

### 3. 检查 payload 结构

```typescript
console.log('Event type:', payload.eventType);
console.log('New record:', payload.new);
console.log('Old record:', payload.old);
console.log('Schema:', payload.schema);
console.log('Table:', payload.table);
```

---

## 🎓 最佳实践

1. **始终使用 filter**
   - 减少不必要的数据传输
   - 提高性能

2. **处理所有事件类型**
   - INSERT
   - UPDATE
   - DELETE

3. **乐观更新 + Realtime**
   - 本地操作立即反馈
   - Realtime 确保多设备同步

4. **错误处理**
   - 订阅失败时重试
   - 网络断开时提示用户

5. **清理资源**
   - 组件卸载时取消订阅
   - 避免内存泄漏

---

## 📚 相关文档

- [Supabase Realtime 文档](https://supabase.com/docs/guides/realtime)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Realtime Quotas](https://supabase.com/docs/guides/realtime/quotas)

---

## ✅ 配置检查清单

- [ ] 在 Supabase Dashboard 启用 Realtime
- [ ] 添加 todos 表到 publication
- [ ] 代码中添加 Realtime 订阅
- [ ] 处理 INSERT/UPDATE/DELETE 事件
- [ ] 添加 filter 过滤用户数据
- [ ] 实现乐观更新
- [ ] 添加错误处理
- [ ] 清理订阅资源
- [ ] 测试跨设备同步

完成以上步骤后，Realtime 功能即可正常使用！🎉

