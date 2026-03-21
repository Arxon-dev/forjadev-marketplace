"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";
import { Button } from "@/components/ui/button";

interface SiteHeaderProps {
  isAuthenticated?: boolean;
  userEmail?: string | null;
  role?: string | null;
}

interface HeaderLink {
  href: string;
  label: string;
  match?: "exact" | "startsWith";
}

const primaryLinks: HeaderLink[] = [
  { href: "/products", label: "Productos", match: "startsWith" },
  { href: "/categories", label: "Categorias", match: "startsWith" },
  { href: "/games", label: "Juegos", match: "startsWith" },
  { href: "/bundles", label: "Bundles", match: "startsWith" },
  { href: "/deals", label: "Deals", match: "startsWith" },
];

const secondaryLinks: HeaderLink[] = [
  { href: "/collections", label: "Colecciones", match: "startsWith" },
  { href: "/help", label: "Ayuda", match: "startsWith" },
  { href: "/policies", label: "Trust", match: "startsWith" },
  { href: "/seller", label: "Vender", match: "startsWith" },
];

const accountLinks: HeaderLink[] = [
  { href: "/account", label: "Cuenta", match: "startsWith" },
  { href: "/orders", label: "Pedidos", match: "startsWith" },
  { href: "/licenses", label: "Licencias", match: "startsWith" },
];

function isActivePath(pathname: string, link: HeaderLink) {
  if (link.match === "exact") {
    return pathname === link.href;
  }

  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function navLinkClassName(pathname: string, link: HeaderLink) {
  const active = isActivePath(pathname, link);

  return active
    ? "inline-flex min-h-10 items-center rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/15 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(2,8,23,0.18)]"
    : "inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-[var(--text-soft)] transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white";
}

function quietLinkClassName(pathname: string, link: HeaderLink) {
  const active = isActivePath(pathname, link);

  return active
    ? "text-sm font-semibold text-white"
    : "text-sm text-[var(--text-soft)] transition hover:text-white";
}

export function SiteHeader({
  isAuthenticated = false,
  userEmail = null,
  role = null,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = searchQuery.trim();
    const target = trimmedQuery
      ? `/products?q=${encodeURIComponent(trimmedQuery)}`
      : "/products";

    trackMarketplaceEvent({
      eventName: "search.executed",
      pageType: "header",
      metadata: {
        source: "public_header",
        query: trimmedQuery,
      },
    });

    router.push(target);
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(7,12,24,0.88)] backdrop-blur-xl"
      data-public-header="premium"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_65%)]" />
      <div className="container-shell relative py-4">
        <div className="rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(155deg,rgba(255,255,255,0.08),rgba(18,27,46,0.92)_48%,rgba(10,16,31,0.98))] px-4 py-4 shadow-[0_24px_54px_rgba(2,8,23,0.28)] md:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <Link href="/" className="shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/10 bg-[linear-gradient(135deg,var(--primary-soft),rgba(31,214,200,0.16))] shadow-[0_14px_30px_rgba(2,8,23,0.22)]">
                  <span className="text-lg font-bold text-white">F</span>
                </div>
              </Link>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/" className="text-xl font-bold tracking-tight text-white">
                    ForjaDev
                  </Link>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Marketplace premium
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  Discovery, bundles, deals y compra con contexto para recursos de game servers.
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 xl:max-w-[40rem]">
              <form
                onSubmit={handleSearchSubmit}
                className="flex flex-col gap-3 sm:flex-row"
                data-public-search="header"
              >
                <label className="sr-only" htmlFor="site-header-search">
                  Buscar en el marketplace
                </label>
                <div className="relative flex-1">
                  <input
                    id="site-header-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar plugins, mapas, bundles o compatibilidad..."
                    className="h-12 w-full rounded-full border border-white/10 bg-black/20 px-5 pr-12 text-sm text-white placeholder:text-white/30 focus:border-[var(--primary)]/40 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Search
                  </span>
                </div>
                <Button type="submit" className="h-12 rounded-full px-5">
                  Buscar
                </Button>
              </form>

              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                <span>Browse con intencion</span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span>Trust visible</span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span>Continuidad a compra</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 xl:justify-end">
              {user ? (
                <>
                  <div className="hidden min-w-0 rounded-[1.35rem] border border-white/10 bg-black/15 px-3 py-2 md:flex md:flex-col">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                      Sesion activa
                    </span>
                    <span className="max-w-56 truncate text-sm font-medium text-white">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {accountLinks.map((link) => (
                      <Link key={link.href} href={link.href} className={quietLinkClassName(pathname, link)}>
                        {link.label}
                      </Link>
                    ))}
                    {role === "admin" ? (
                      <Link href="/admin" className={quietLinkClassName(pathname, { href: "/admin", label: "Admin", match: "startsWith" })}>
                        Admin
                      </Link>
                    ) : null}
                    <Button variant="ghost" onClick={handleLogout} className="rounded-full border border-white/10 px-4">
                      Salir
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" className="rounded-full border border-white/10 px-4">
                      Entrar
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="rounded-full px-4">Crear cuenta</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap gap-2" data-public-nav="primary">
              {primaryLinks.map((link) => (
                <Link key={link.href} href={link.href} className={navLinkClassName(pathname, link)}>
                  {link.label}
                </Link>
              ))}
            </nav>

            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" data-public-nav="secondary">
              {secondaryLinks.map((link) => (
                <Link key={link.href} href={link.href} className={quietLinkClassName(pathname, link)}>
                  {link.label}
                </Link>
              ))}
              {user ? (
                <>
                  <span className="hidden text-[var(--text-muted)] lg:inline">/</span>
                  <Link href="/dashboard" className={quietLinkClassName(pathname, { href: "/dashboard", label: "Workspace", match: "startsWith" })}>
                    Workspace
                  </Link>
                </>
              ) : null}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
