import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl font-light text-stone-800 tracking-wide">
            おかえり
          </h1>
          <p className="text-stone-500 text-sm tracking-widest font-light">
            WELCOME BACK
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
