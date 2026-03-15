import { ReactNode } from "react";

interface AuthFormProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthForm({ title, subtitle, children }: AuthFormProps) {
  return (
    <main className="container-shell flex min-h-screen items-center justify-center py-16">
      {/* Card con glassmorphism */}
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-[var(--text-soft)]">{subtitle}</p>}

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
