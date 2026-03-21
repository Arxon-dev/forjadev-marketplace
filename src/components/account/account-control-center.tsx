"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AccountShortcut {
  label: string;
  value: string;
  href: string;
}

interface LinkedIdentity {
  id: string;
  provider: "discord" | "steam";
  providerEmail: string | null;
  providerUsername: string | null;
}

interface AccountControlCenterProps {
  email: string | null;
  role: string | null;
  initialDisplayName: string;
  initialUsername: string;
  shortcuts: AccountShortcut[];
  unreadNotifications: number;
  linkedIdentities: LinkedIdentity[];
}

export function AccountControlCenter({
  email,
  role,
  initialDisplayName,
  initialUsername,
  shortcuts,
  unreadNotifications,
  linkedIdentities,
}: AccountControlCenterProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          username,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            profile?: {
              displayName?: string;
              username?: string;
            };
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar la cuenta");
      }

      setDisplayName(payload?.profile?.displayName || displayName);
      setUsername(payload?.profile?.username || username);
      setMessage("Cuenta actualizada correctamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la cuenta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="container-shell py-16">
      <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              User control center
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">Cuenta</h1>
            <p className="mt-4 max-w-3xl text-lg text-[var(--text-soft)]">
              Gestiona tu identidad visible, revisa tus conexiones y vuelve rapido a las superficies donde ya compras, guardas, sigues y resuelves.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              {unreadNotifications} notificaciones sin leer
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Rol {role || "buyer"}
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={handleSave}
            className="rounded-3xl border border-white/10 bg-black/10 p-6"
            data-account-center="profile"
          >
            <h2 className="text-2xl font-semibold text-white">Identidad visible</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Esta capa deja de ser solo lectura: ahora puedes ajustar tu nombre visible y tu username desde un centro de control propio.
            </p>

            {message ? (
              <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white">Email</label>
                <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-soft)]">
                  {email || "Sin email"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white">Nombre visible</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="Tu nombre visible"
                  disabled={busy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white">Nombre de usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="tunombre"
                  disabled={busy}
                />
                <p className="mt-2 text-xs text-[var(--text-soft)]">
                  Se normaliza a minusculas, numeros, guion y guion bajo.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando..." : "Guardar identidad"}
              </Button>
            </div>
          </form>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-black/10 p-6" data-account-center="shortcuts">
              <h2 className="text-2xl font-semibold text-white">Control operativo</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Accesos rapidos a las superficies donde tu cuenta ya actua como buyer, curador y usuario recurrente.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {shortcuts.map((shortcut) => (
                  <Link
                    key={`${shortcut.href}:${shortcut.label}`}
                    href={shortcut.href}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                      {shortcut.label}
                    </p>
                    <p className="mt-3 text-2xl font-bold text-white">{shortcut.value}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/10 p-6" data-account-center="identities">
              <h2 className="text-2xl font-semibold text-white">Conexiones</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Las identidades conectadas refuerzan confianza y continuidad sin abrir una capa social compleja.
              </p>

              {linkedIdentities.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {linkedIdentities.map((identity) => (
                    <div
                      key={identity.id}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
                        {identity.provider}
                      </p>
                      <p className="mt-2 text-sm text-[var(--text-soft)]">
                        {identity.providerUsername ||
                          identity.providerEmail ||
                          "Cuenta vinculada correctamente"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-[var(--text-soft)]">
                  Sin conexiones externas todavia.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
