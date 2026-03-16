import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { SiteHeaderServer } from "@/components/layout/site-header-server";

export default function LoginPage() {
  return (
    <main>
      <SiteHeaderServer />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
