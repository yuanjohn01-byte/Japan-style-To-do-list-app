import { createClient } from './client';

const BUCKET_NAME = 'my-todo';

/**
 * 上传图片到 Supabase Storage
 * @param file - 要上传的文件
 * @param userId - 用户ID，用于创建用户专属目录
 * @returns 图片的公开访问 URL
 */
export async function uploadTodoImage(
  file: File,
  userId: string
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  try {
    const supabase = createClient();

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return { url: null, error: '只能上传图片文件' };
    }

    // 验证文件大小（限制为 5MB）
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return { url: null, error: '图片大小不能超过 5MB' };
    }

    // 生成唯一文件名：用户ID/时间戳-随机字符串.扩展名
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // 上传文件到 my-todo bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false, // 不覆盖已存在的文件
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { url: null, error: `上传失败: ${uploadError.message}` };
    }

    // 获取公开访问 URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return { url: null, error: '获取图片 URL 失败' };
    }

    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { url: null, error: '上传过程中发生错误' };
  }
}

/**
 * 删除图片从 Supabase Storage
 * @param imageUrl - 图片的完整 URL
 * @param userId - 用户ID，用于验证权限
 */
export async function deleteTodoImage(
  imageUrl: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createClient();

    // 从 URL 中提取文件路径
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
    
    if (pathParts.length < 2) {
      return { success: false, error: '无效的图片 URL' };
    }

    const filePath = pathParts[1];

    // 验证文件路径是否属于当前用户
    if (!filePath.startsWith(userId)) {
      return { success: false, error: '无权删除此图片' };
    }

    // 删除文件
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return { success: false, error: `删除失败: ${deleteError.message}` };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { success: false, error: '删除过程中发生错误' };
  }
}

/**
 * 替换 todo 的图片
 * 先删除旧图片，再上传新图片
 */
export async function replaceTodoImage(
  oldImageUrl: string | null,
  newFile: File,
  userId: string
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  // 如果有旧图片，先删除
  if (oldImageUrl) {
    await deleteTodoImage(oldImageUrl, userId);
  }

  // 上传新图片
  return uploadTodoImage(newFile, userId);
}

