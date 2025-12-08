import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl font-light text-stone-800 tracking-wide">
            新しい旅
          </h1>
          <p className="text-stone-500 text-sm tracking-widest font-light">
            BEGIN YOUR JOURNEY
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  );
}
