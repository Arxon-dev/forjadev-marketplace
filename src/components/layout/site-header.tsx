import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
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
          <Link href="/dashboard" className="text-sm text-[var(--text-soft)] hover:text-white">
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Link href="/register">
            <Button>Crear cuenta</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
