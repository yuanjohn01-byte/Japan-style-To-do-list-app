import { createClient } from './client';

// Lazy singleton instance for client-side use
let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient();
  }
  return supabaseInstance;
}

// Export as a getter to avoid initialization at module load time
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof typeof client];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// Todo type definition
export interface Todo {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// Re-export the createClient function if needed elsewhere
export { createClient };

