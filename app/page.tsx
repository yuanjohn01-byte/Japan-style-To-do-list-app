'use client';

import { useEffect, useState } from 'react';
import { supabase, type Todo } from '@/lib/supabase';
import { Plus, Circle, CheckCircle2, X, Loader2, AlertCircle, Image as ImageIcon, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { uploadTodoImage, deleteTodoImage, replaceTodoImage } from '@/lib/supabase/storage';

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null); // todo id that is uploading
  const router = useRouter();

  useEffect(() => {
    // Check auth state and fetch todos
    const initializeApp = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        // Only fetch todos if user is logged in
        if (user) {
          await fetchTodos();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error initializing app:', err);
        setError('初始化失败，请刷新页面重试');
        setLoading(false);
      }
    };

    initializeApp();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      // Refetch todos when user logs in/out
      if (newUser) {
        await fetchTodos();
      } else {
        setTodos([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * 获取当前用户的所有 todos
   * RLS 策略会自动过滤，只返回当前用户的数据
   */
  const fetchTodos = async () => {
    try {
      setError(null);
      
      // 检查用户是否登录
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTodos([]);
        setLoading(false);
        return;
      }

      // 查询当前用户的 todos，RLS 会自动过滤
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
      
      setTodos(data || []);
    } catch (err) {
      console.error('Error fetching todos:', err);
      setError('获取待办事项失败，请稍后重试');
      setTodos([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 添加新的 todo - 通过 AI 解析
   * 调用后端 API，使用 AI 解析文本中的待办事项
   */
  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const todoText = newTodo.trim();
    if (!todoText) return;

    // 检查用户是否登录
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // 验证文本长度
    if (todoText.length > 2000) {
      setError('文本内容过长，最多 2000 字符');
      return;
    }

    setAdding(true);
    setError(null);
    
    try {
      // 调用后端 API 解析待办事项
      const response = await fetch('/api/parse-todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: todoText,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '解析失败');
      }

      if (result.success && result.todos) {
        // 添加新的 todos 到列表顶部
        setTodos([...result.todos, ...todos]);
        setNewTodo('');
        
        // 显示成功提示
        if (result.count > 1) {
          console.log(`✅ 成功添加 ${result.count} 条待办事项`);
        }
      }
    } catch (err: any) {
      console.error('Error adding todo:', err);
      setError(err.message || 'AI 解析失败，请重试');
    } finally {
      setAdding(false);
    }
  };

  /**
   * 切换 todo 的完成状态
   * RLS 策略确保只能更新当前用户的 todo
   */
  const toggleTodo = async (id: string, completed: boolean) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // 乐观更新 UI
    const newCompleted = !completed;
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: newCompleted } : todo
      )
    );

    try {
      setError(null);
      
      // 更新数据库，RLS 会确保只能更新自己的 todo
      const { error } = await supabase
        .from('todos')
        .update({ completed: newCompleted })
        .eq('id', id)
        .eq('user_id', user.id); // 显式检查 user_id，双重保险

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
    } catch (err) {
      console.error('Error toggling todo:', err);
      setError('更新失败，请重试');
      
      // 回滚 UI 更新
      setTodos(
        todos.map((todo) =>
          todo.id === id ? { ...todo, completed } : todo
        )
      );
    }
  };

  /**
   * 删除 todo
   * RLS 策略确保只能删除当前用户的 todo
   */
  const deleteTodo = async (id: string) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // 保存原始数据以便回滚
    const originalTodos = [...todos];
    
    // 乐观更新 UI
    setTodos(todos.filter((todo) => todo.id !== id));

    try {
      setError(null);
      
      // 删除数据库记录，RLS 会确保只能删除自己的 todo
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // 显式检查 user_id，双重保险

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
    } catch (err) {
      console.error('Error deleting todo:', err);
      setError('删除失败，请重试');
      
      // 回滚 UI 更新
      setTodos(originalTodos);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h1 className="text-4xl font-light text-stone-800 tracking-wide">
            我的待做事项
          </h1>
          <p className="text-stone-500 text-sm tracking-widest font-light">
            MY TODOS
          </p>
          {user && (
            <p className="text-xs text-stone-400 font-light">
              已登录: {user.email}
            </p>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-light">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl shadow-stone-200/50 p-8 mb-6 border border-stone-200/50">
          <form onSubmit={addTodo} className="space-y-3">
            <div className="flex gap-3">
              <textarea
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="描述你的待办事项，AI 会帮你智能解析...&#10;例如：明天要开会，写报告，还要给客户打电话"
                disabled={adding}
                rows={3}
                className="flex-1 px-6 py-4 bg-stone-50/50 border border-stone-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent
                         placeholder:text-stone-400 text-stone-700 font-light
                         transition-all duration-300 disabled:opacity-50 resize-none"
              />
              <button
                type="submit"
                disabled={adding || !newTodo.trim()}
                className="px-6 py-4 bg-stone-700 hover:bg-stone-800 text-stone-50 rounded-xl
                         transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-2 shadow-lg shadow-stone-300/50 self-start"
              >
                {adding ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-stone-400 font-light">
              💡 支持批量添加：输入多个任务，AI 会自动识别并分别创建
            </p>
          </form>
        </div>

        <div className="space-y-3">
          {!user ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-stone-100 flex items-center justify-center">
                <Circle className="w-8 h-8 text-stone-300" />
              </div>
              <p className="text-stone-400 font-light tracking-wide">
                请先登录
              </p>
              <p className="text-stone-500 text-sm">
                Please login to view your todos
              </p>
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-stone-100 flex items-center justify-center">
                <Circle className="w-8 h-8 text-stone-300" />
              </div>
              <p className="text-stone-400 font-light tracking-wide">
                空白の美学
              </p>
              <p className="text-stone-500 text-sm">
                The beauty of emptiness
              </p>
            </div>
          ) : (
            todos.map((todo, index) => (
              <div
                key={todo.id}
                className="group bg-white/60 backdrop-blur-sm rounded-xl p-5
                         border border-stone-200/50 shadow-sm hover:shadow-md
                         transition-all duration-300 hover:border-stone-300/50
                         animate-in fade-in slide-in-from-top-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className="flex-shrink-0 transition-all duration-300 hover:scale-110"
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-stone-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-stone-400 hover:text-stone-600" />
                    )}
                  </button>

                  <span
                    className={`flex-1 font-light tracking-wide transition-all duration-300 ${
                      todo.completed
                        ? 'text-stone-400 line-through'
                        : 'text-stone-700'
                    }`}
                  >
                    {todo.text}
                  </span>

                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100
                             transition-all duration-300 hover:scale-110
                             text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {todos.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-3 text-sm text-stone-400 font-light">
              <span>{todos.filter((t) => !t.completed).length} 件未完了</span>
              <span className="w-1 h-1 rounded-full bg-stone-300" />
              <span>{todos.filter((t) => t.completed).length} 件完了</span>
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-xs text-stone-400 tracking-widest font-light">
            侘寂
          </p>
        </div>
      </div>
    </div>
  );
}

