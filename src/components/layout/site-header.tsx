"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Obtiene el usuario actual
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setRole(profile?.role ?? null);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    // Escucha cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    window.location.href = "/";
  };

  return (
    <header className="border-b border-white/10 bg-white/5 backdrop-blur">
      <div className="container-shell flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-bold text-white">
          ForjaDev
        </Link>

        <nav className="hidden gap-6 md:flex">
          <Link href="/products" className="text-sm text-[var(--text-soft)] hover:text-white">
            Productos
          </Link>
          <Link href="/seller" className="text-sm text-[var(--text-soft)] hover:text-white">
            Vender
          </Link>
          {user && (
            <Link href="/dashboard" className="text-sm text-[var(--text-soft)] hover:text-white">
              Dashboard
            </Link>
          )}
          {user && (
            <Link href="/orders" className="text-sm text-[var(--text-soft)] hover:text-white">
              Pedidos
            </Link>
          )}
          {user && (
            <Link href="/licenses" className="text-sm text-[var(--text-soft)] hover:text-white">
              Licencias
            </Link>
          )}
          {role === "admin" && (
            <Link href="/admin" className="text-sm text-[var(--text-soft)] hover:text-white">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {!loading && user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-600" />
                <span className="text-sm text-white">{user.email}</span>
              </div>
              <Button variant="ghost" onClick={handleLogout}>
                Salir
              </Button>
            </>
          ) : !loading ? (
            <>
              <Link href="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link href="/register">
                <Button>Crear cuenta</Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
