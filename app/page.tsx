'use client';

import { useEffect, useState } from 'react';
import { supabase, type Todo } from '@/lib/supabase';
import { Plus, Circle, CheckCircle2, X, Loader2, AlertCircle, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { uploadTodoImage, deleteTodoImage } from '@/lib/supabase/storage';

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
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
   * 处理图片选择
   */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('只能上传图片文件');
      return;
    }

    // 验证文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }

    setSelectedImage(file);
    
    // 创建预览
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  /**
   * 清除选中的图片
   */
  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  /**
   * 添加新的 todo（包含图片上传）
   * 要求用户必须登录，并自动关联到当前用户
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

    // 验证文本长度（与数据库约束一致）
    if (todoText.length > 500) {
      setError('待办事项内容不能超过 500 字符');
      return;
    }

    setAdding(true);
    setError(null);
    
    try {
      let imageUrl: string | null = null;

      // 如果有选中的图片，先上传
      if (selectedImage) {
        setUploadingImage(true);
        const { url, error: uploadError } = await uploadTodoImage(selectedImage, user.id);
        
        if (uploadError) {
          throw new Error(uploadError);
        }
        
        imageUrl = url;
        setUploadingImage(false);
      }

      // 插入新的 todo，包含 user_id 和 image_url
      const { data, error } = await supabase
        .from('todos')
        .insert([{ 
          text: todoText,
          user_id: user.id,
          completed: false,
          image_url: imageUrl
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
      
      if (data) {
        // 乐观更新 UI
        setTodos([data, ...todos]);
        setNewTodo('');
        clearSelectedImage();
      }
    } catch (err) {
      console.error('Error adding todo:', err);
      setError(err instanceof Error ? err.message : '添加失败，请重试');
    } finally {
      setAdding(false);
      setUploadingImage(false);
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
   * 删除 todo（包含删除关联的图片）
   * RLS 策略确保只能删除当前用户的 todo
   */
  const deleteTodo = async (id: string) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // 保存原始数据以便回滚
    const originalTodos = [...todos];
    const todoToDelete = todos.find(t => t.id === id);
    
    // 乐观更新 UI
    setTodos(todos.filter((todo) => todo.id !== id));

    try {
      setError(null);
      
      // 如果有图片，先删除图片
      if (todoToDelete?.image_url) {
        await deleteTodoImage(todoToDelete.image_url, user.id);
      }
      
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
          <form onSubmit={addTodo} className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="新しいことを書く..."
                disabled={adding}
                className="flex-1 px-6 py-4 bg-stone-50/50 border border-stone-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent
                         placeholder:text-stone-400 text-stone-700 font-light
                         transition-all duration-300 disabled:opacity-50"
              />
              
              {/* 图片上传按钮 */}
              <label className="px-6 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl
                              transition-all duration-300 cursor-pointer flex items-center gap-2 shadow-sm">
                <ImageIcon className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={adding}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={adding || !newTodo.trim()}
                className="px-6 py-4 bg-stone-700 hover:bg-stone-800 text-stone-50 rounded-xl
                         transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-2 shadow-lg shadow-stone-300/50"
              >
                {adding ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* 图片预览 */}
            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-24 w-24 object-cover rounded-lg border-2 border-stone-200"
                />
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  disabled={adding}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
            )}
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
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className="flex-shrink-0 transition-all duration-300 hover:scale-110 mt-1"
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-stone-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-stone-400 hover:text-stone-600" />
                    )}
                  </button>

                  <div className="flex-1 space-y-3">
                    <span
                      className={`font-light tracking-wide transition-all duration-300 block ${
                        todo.completed
                          ? 'text-stone-400 line-through'
                          : 'text-stone-700'
                      }`}
                    >
                      {todo.text}
                    </span>

                    {/* 图片附件 */}
                    {todo.image_url && (
                      <div className="relative inline-block group/image">
                        <img
                          src={todo.image_url}
                          alt="Todo attachment"
                          className="h-32 w-32 object-cover rounded-lg border-2 border-stone-200 cursor-pointer hover:border-stone-400 transition-all"
                          onClick={() => window.open(todo.image_url!, '_blank')}
                        />
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 rounded-lg transition-all duration-200" />
                      </div>
                    )}
                  </div>

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

