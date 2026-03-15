import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { SiteHeader } from "@/components/layout/site-header";

export default function RegisterPage() {
  return (
    <main>
      <SiteHeader />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
