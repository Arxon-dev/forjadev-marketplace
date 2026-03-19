"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function OnboardingForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [steamUrl, setSteamUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!storeName || !slug) {
      setError("Por favor completa los campos requeridos");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Obtiene el usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // Crea el vendor
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .insert([
          {
            user_id: user.id,
            store_name: storeName,
            slug: slug.toLowerCase().replace(/\s+/g, "-"),
            bio,
            discord_url: discordUrl || null,
            steam_url: steamUrl || null,
            x_url: xUrl || null,
            website_url: websiteUrl || null,
          },
        ])
        .select()
        .single();

      if (vendorError) throw vendorError;

      // Actualiza el role del usuario a 'seller'
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: "seller" })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Redirige al panel de vendedor
      router.push("/seller");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al crear la tienda";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (text: string) => {
    setStoreName(text);
    setSlug(text.toLowerCase().replace(/\s+/g, "-"));
  };

  return (
    <section className="container-shell flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <h1 className="text-2xl font-bold text-white">Crear tu tienda</h1>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Completa estos datos para abrir tu tienda de vendedor
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white">
              Nombre de tienda *
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => generateSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="Mi Tienda Creativa"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white">
              Slug (URL) *
            </label>
            <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-2">
              <span className="text-white/50">forjadev.shop/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                className="ml-2 flex-1 border-0 bg-transparent text-white outline-none placeholder-white/30"
                placeholder="mi-tienda"
                disabled={loading}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-soft)]">
              Debe ser único y solo contener letras, números y guiones
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="Describe brevemente tu tienda..."
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-white">Discord</label>
              <input
                type="url"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                placeholder="https://discord.gg/tu-comunidad"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white">Steam</label>
              <input
                type="url"
                value={steamUrl}
                onChange={(e) => setSteamUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                placeholder="https://steamcommunity.com/id/tu-perfil"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white">X / Twitter</label>
              <input
                type="url"
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                placeholder="https://x.com/tu-cuenta"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white">Web</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                placeholder="https://tu-sitio.dev"
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creando tienda..." : "Crear tienda"}
          </Button>
        </form>
      </div>
    </section>
  );
}
