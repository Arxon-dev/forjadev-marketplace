"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SiteHeaderProps {
  isAuthenticated?: boolean;
  userEmail?: string | null;
  role?: string | null;
}

export function SiteHeader({
  isAuthenticated = false,
  userEmail = null,
  role = null,
}: SiteHeaderProps) {
  const user = isAuthenticated ? { email: userEmail } : null;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <header className="border-b border-white/10 bg-white/5 backdrop-blur">
      <div className="container-shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold text-white">
          ForjaDev
        </Link>

        <nav className="hidden gap-6 md:flex">
          <Link href="/products" className="text-sm text-[var(--text-soft)] hover:text-white">
            Productos
          </Link>
          <Link href="/categories" className="text-sm text-[var(--text-soft)] hover:text-white">
            Categorias
          </Link>
          <Link href="/games" className="text-sm text-[var(--text-soft)] hover:text-white">
            Juegos
          </Link>
          <Link href="/bundles" className="text-sm text-[var(--text-soft)] hover:text-white">
            Bundles
          </Link>
          <Link href="/deals" className="text-sm text-[var(--text-soft)] hover:text-white">
            Deals
          </Link>
          <Link href="/collections" className="text-sm text-[var(--text-soft)] hover:text-white">
            Colecciones
          </Link>
          <Link href="/help" className="text-sm text-[var(--text-soft)] hover:text-white">
            Ayuda
          </Link>
          <Link href="/policies" className="text-sm text-[var(--text-soft)] hover:text-white">
            Policies
          </Link>
          <Link href="/seller" className="text-sm text-[var(--text-soft)] hover:text-white">
            Vender
          </Link>
          {user ? (
            <Link href="/account" className="text-sm text-[var(--text-soft)] hover:text-white">
              Cuenta
            </Link>
          ) : null}
          {user ? (
            <Link href="/dashboard" className="text-sm text-[var(--text-soft)] hover:text-white">
              Dashboard
            </Link>
          ) : null}
          {user ? (
            <Link href="/feed" className="text-sm text-[var(--text-soft)] hover:text-white">
              Actividad
            </Link>
          ) : null}
          {user ? (
            <Link href="/orders" className="text-sm text-[var(--text-soft)] hover:text-white">
              Pedidos
            </Link>
          ) : null}
          {user ? (
            <Link href="/disputes" className="text-sm text-[var(--text-soft)] hover:text-white">
              Disputas
            </Link>
          ) : null}
          {user ? (
            <Link href="/licenses" className="text-sm text-[var(--text-soft)] hover:text-white">
              Licencias
            </Link>
          ) : null}
          {role === "admin" ? (
            <Link href="/admin" className="text-sm text-[var(--text-soft)] hover:text-white">
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden items-center gap-2 md:flex">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500" />
                <span className="max-w-48 truncate text-sm text-white">{user.email}</span>
              </div>
              <Button variant="ghost" onClick={handleLogout}>
                Salir
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link href="/register">
                <Button>Crear cuenta</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
