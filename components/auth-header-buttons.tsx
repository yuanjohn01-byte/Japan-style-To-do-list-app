"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

export function AuthHeaderButtons() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-16 h-9 bg-stone-200/50 animate-pulse rounded-xl" />
        <div className="w-20 h-9 bg-stone-200/50 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-600 font-light hidden sm:block">
          {user.email}
        </span>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-700 hover:bg-stone-800 text-stone-50 rounded-xl transition-all duration-300 font-light text-sm shadow-lg shadow-stone-300/50"
        >
          <span>退出登录</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-stone-200/50 rounded-xl hover:bg-white/80 hover:border-stone-300/50 transition-all duration-300 text-stone-700 font-light text-sm shadow-sm hover:shadow-md"
      >
        <span>Login</span>
      </Link>
      <Link
        href="/auth/sign-up"
        className="inline-flex items-center gap-2 px-4 py-2 bg-stone-700 hover:bg-stone-800 text-stone-50 rounded-xl transition-all duration-300 font-light text-sm shadow-lg shadow-stone-300/50"
      >
        <span>Sign Up</span>
      </Link>
    </div>
  );
}

