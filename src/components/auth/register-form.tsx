"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthForm } from "./auth-form";
import { SocialAuthButtons } from "./social-auth-buttons";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email || !username || !password || !confirmPassword) {
      setError("Por favor completa todos los campos");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: username,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      const emailConfirmationRequired = data.session === null;

      if (emailConfirmationRequired) {
        setMessage("Cuenta creada. Revisa tu correo para confirmar tu email.");
        setTimeout(() => {
          router.push("/login?email_confirmed=false");
        }, 2000);
      } else if (data.session) {
        const { error: profileError } = await supabase.rpc("ensure_profile_exists");

        if (profileError) {
          throw profileError;
        }

        setMessage("Cuenta creada exitosamente.");
        setTimeout(() => {
          router.push("/dashboard");
        }, 500);
      } else {
        setMessage("Cuenta creada. Inicia sesion con tus credenciales.");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Error en el registro";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm title="Crear cuenta" subtitle="Unete a ForjaDev Marketplace">
      <SocialAuthButtons />

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">
          o crea con email
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {message ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="tu@email.com"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">
            Nombre de usuario
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="tunombre"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">
            Contrasena
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="********"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">
            Confirmar contrasena
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="********"
            disabled={loading}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-soft)]">
        Ya tienes cuenta?{" "}
        <Link href="/login" className="text-white hover:underline">
          Inicia sesion
        </Link>
      </p>
    </AuthForm>
  );
}
