"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SocialAuthButtonsProps {
  next?: string;
}

const PROVIDERS = [
  {
    provider: "discord" as const,
    label: "Continuar con Discord",
    tone: "bg-[#5865F2]/20 border-[#5865F2]/40 text-white hover:bg-[#5865F2]/30",
  },
  {
    provider: "steam" as const,
    label: "Continuar con Steam",
    tone: "bg-[#1b2838]/70 border-[#66c0f4]/30 text-white hover:bg-[#22374d]",
  },
];

export function SocialAuthButtons({ next = "/dashboard" }: SocialAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleProviderSignIn = async (provider: "discord" | "steam") => {
    setError("");
    setLoadingProvider(provider);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "No se pudo iniciar el flujo social"
      );
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {PROVIDERS.map((item) => (
          <button
            key={item.provider}
            type="button"
            onClick={() => handleProviderSignIn(item.provider)}
            disabled={Boolean(loadingProvider)}
            className={`inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${item.tone}`}
          >
            {loadingProvider === item.provider ? "Conectando..." : item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
