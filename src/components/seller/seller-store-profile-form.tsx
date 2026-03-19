"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface SellerStoreProfileFormProps {
  vendor: {
    id: string;
    store_name: string;
    slug: string;
    bio: string | null;
    discord_url?: string | null;
    steam_url?: string | null;
    x_url?: string | null;
    website_url?: string | null;
  };
  onUpdated: (vendor: {
    store_name: string;
    slug: string;
    bio: string | null;
    discord_url: string | null;
    steam_url: string | null;
    x_url: string | null;
    website_url: string | null;
  }) => void;
}

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SellerStoreProfileForm({
  vendor,
  onUpdated,
}: SellerStoreProfileFormProps) {
  const [storeName, setStoreName] = useState(vendor.store_name);
  const [slug, setSlug] = useState(vendor.slug);
  const [bio, setBio] = useState(vendor.bio || "");
  const [discordUrl, setDiscordUrl] = useState(vendor.discord_url || "");
  const [steamUrl, setSteamUrl] = useState(vendor.steam_url || "");
  const [xUrl, setXUrl] = useState(vendor.x_url || "");
  const [websiteUrl, setWebsiteUrl] = useState(vendor.website_url || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!storeName.trim() || !slug.trim()) {
      setError("Debes indicar nombre y slug de tienda.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const nextSlug = sanitizeSlug(slug);

      const { error: updateError } = await supabase
        .from("vendors")
        .update({
          store_name: storeName.trim(),
          slug: nextSlug,
          bio: bio.trim() || null,
          discord_url: discordUrl.trim() || null,
          steam_url: steamUrl.trim() || null,
          x_url: xUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        })
        .eq("id", vendor.id);

      if (updateError) {
        throw updateError;
      }

      onUpdated({
        store_name: storeName.trim(),
        slug: nextSlug,
        bio: bio.trim() || null,
        discord_url: discordUrl.trim() || null,
        steam_url: steamUrl.trim() || null,
        x_url: xUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
      });
      setSuccess("Perfil publico actualizado correctamente.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la tienda"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Perfil publico de la tienda</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Conecta tu presencia en Discord, Steam y web para que el marketplace se sienta parte del ecosistema real.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-white">Nombre de tienda</label>
          <input
            type="text"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">Slug publico</label>
          <input
            type="text"
            value={slug}
            onChange={(event) => setSlug(sanitizeSlug(event.target.value))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            disabled={loading}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-white">Bio</label>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            rows={4}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">Discord</label>
          <input
            type="url"
            value={discordUrl}
            onChange={(event) => setDiscordUrl(event.target.value)}
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
            onChange={(event) => setSteamUrl(event.target.value)}
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
            onChange={(event) => setXUrl(event.target.value)}
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
            onChange={(event) => setWebsiteUrl(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="https://tu-sitio.dev"
            disabled={loading}
          />
        </div>
      </div>

      <div className="mt-5">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar perfil"}
        </Button>
      </div>
    </form>
  );
}
