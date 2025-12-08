import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { AuthHeaderButtons } from "@/components/auth-header-buttons";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "我的待做事项 - My Todos",
  description: "A beautiful todo app with Next.js and Supabase",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100 min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <header className="border-b border-stone-200/50 bg-white/60 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <Link 
                  href="/" 
                  className="flex items-center space-x-3 hover:opacity-70 transition-opacity"
                >
                  <span className="text-2xl font-light text-stone-800 tracking-wide">
                    我的待做事项
                  </span>
                  <span className="text-xs text-stone-400 tracking-widest font-light hidden sm:block">
                    MY TODOS
                  </span>
                </Link>
                <AuthHeaderButtons />
              </div>
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
