import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { SiteHeaderServer } from "@/components/layout/site-header-server";

export default function RegisterPage() {
  return (
    <main>
      <SiteHeaderServer />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
