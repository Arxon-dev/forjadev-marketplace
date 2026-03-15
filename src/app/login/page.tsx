import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { SiteHeader } from "@/components/layout/site-header";

export default function LoginPage() {
  return (
    <main>
      <SiteHeader />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
