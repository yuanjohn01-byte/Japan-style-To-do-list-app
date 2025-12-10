import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// 初始化 Supabase 客户端（使用 service role key 绕过 RLS）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const { text, userId } = await request.json();

    // 验证输入
    if (!text || !userId) {
      return NextResponse.json(
        { error: '缺少必要参数：text 和 userId' },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: '文本内容过长，最多 2000 字符' },
        { status: 400 }
      );
    }

    console.log('📝 开始解析待办事项...');
    console.log('用户ID:', userId);
    console.log('输入文本:', text);

    // 调用 OpenAI API 解析待办事项
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个专业的待办事项助手。用户会给你一段文字，你需要从中提取所有的待办事项。

规则：
1. 识别文本中所有需要完成的任务、事项、计划
2. 每个待办事项应该简洁明确，一句话描述
3. 如果文本中有多个任务，提取所有任务
4. 如果只有一个任务，返回一个任务
5. 如果文本中没有明确的待办事项，尝试理解用户意图并创建合理的待办事项
6. 返回 JSON 格式：{ "todos": ["任务1", "任务2", ...] }
7. 只返回 JSON，不要有其他文字

示例：
输入："明天要开会，然后写报告，还要给客户打电话"
输出：{"todos": ["开会", "写报告", "给客户打电话"]}

输入："买菜"
输出：{"todos": ["买菜"]}`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('AI 未返回有效响应');
    }

    console.log('🤖 AI 响应:', aiResponse);

    // 解析 AI 返回的 JSON
    let parsedTodos: { todos: string[] };
    try {
      parsedTodos = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError);
      throw new Error('AI 返回的格式不正确');
    }

    if (!parsedTodos.todos || !Array.isArray(parsedTodos.todos)) {
      throw new Error('AI 返回的数据格式不正确');
    }

    if (parsedTodos.todos.length === 0) {
      return NextResponse.json(
        { error: '未能从文本中提取出待办事项' },
        { status: 400 }
      );
    }

    console.log('✅ 解析出的待办事项:', parsedTodos.todos);

    // 准备插入数据库的数据
    const todosToInsert = parsedTodos.todos.map((todoText) => ({
      user_id: userId,
      text: todoText.substring(0, 500), // 限制长度
      completed: false,
    }));

    // 使用 Supabase Admin 客户端插入数据（绕过 RLS）
    const { data: insertedTodos, error: insertError } = await supabaseAdmin
      .from('todos')
      .insert(todosToInsert)
      .select();

    if (insertError) {
      console.error('❌ 数据库插入失败:', insertError);
      throw new Error(`数据库插入失败: ${insertError.message}`);
    }

    console.log('✅ 成功插入', insertedTodos?.length, '条待办事项');

    return NextResponse.json({
      success: true,
      todos: insertedTodos,
      count: insertedTodos?.length || 0,
    });
  } catch (error: any) {
    console.error('❌ API 错误:', error);

    // 处理不同类型的错误
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'AI 服务连接失败，请检查网络或配置' },
        { status: 503 }
      );
    }

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'AI API 密钥无效，请检查配置' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || '服务器内部错误' },
      { status: 500 }
    );
  }
}

