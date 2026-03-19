"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { uploadProductImage } from "@/lib/supabase/storage";

interface BundleFormProps {
  bundleId?: string;
  onSuccess: () => void;
}

interface VendorSummary {
  id: string;
}

interface ProductOption {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  featured_image_url: string | null;
  moderation_status: string;
}

function slugifyTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function BundleForm({ bundleId, onSuccess }: BundleFormProps) {
  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  const selectedProducts = products.filter((product) => selectedProductIds.includes(product.id));
  const originalTotalCents = selectedProducts.reduce((sum, product) => sum + product.price_cents, 0);
  const originalTotalLabel = `EUR ${(originalTotalCents / 100).toFixed(2)}`;
  const bundlePriceCents = Math.max(0, Math.round((Number.parseFloat(price) || 0) * 100));
  const savingsCents = Math.max(0, originalTotalCents - bundlePriceCents);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Necesitas iniciar sesion");
        setInitialized(true);
        return;
      }

      const { data: vendorData } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!vendorData) {
        setError("No tienes una tienda creada");
        setInitialized(true);
        return;
      }

      setVendor(vendorData as VendorSummary);

      const { data: productRows } = await supabase
        .from("products")
        .select("id, title, slug, price_cents, featured_image_url, moderation_status")
        .eq("vendor_id", vendorData.id)
        .eq("moderation_status", "approved")
        .order("updated_at", { ascending: false });

      setProducts((productRows || []) as ProductOption[]);

      if (bundleId) {
        const { data: bundleRow } = await supabase
          .from("bundles")
          .select("id, title, short_description, description, price_cents, featured_image_url, is_active")
          .eq("id", bundleId)
          .single();

        const { data: bundleProductRows } = await supabase
          .from("bundle_products")
          .select("product_id")
          .eq("bundle_id", bundleId)
          .order("sort_order", { ascending: true });

        if (bundleRow) {
          setTitle(bundleRow.title);
          setShortDescription(bundleRow.short_description || "");
          setDescription(bundleRow.description || "");
          setPrice((bundleRow.price_cents / 100).toFixed(2));
          setFeaturedImageUrl(bundleRow.featured_image_url || "");
          setIsActive(bundleRow.is_active);
        }

        setSelectedProductIds((bundleProductRows || []).map((row) => row.product_id));
      }

      setInitialized(true);
    };

    fetchData();
  }, [bundleId]);

  const resolveUniqueSlug = async (rawTitle: string) => {
    const supabase = createClient();
    const baseSlug = slugifyTitle(rawTitle) || `bundle-${Date.now()}`;

    const { data: existingBundles, error: slugError } = await supabase
      .from("bundles")
      .select("id, slug")
      .ilike("slug", `${baseSlug}%`);

    if (slugError) {
      throw slugError;
    }

    const usedSlugs = new Set(
      (existingBundles || [])
        .filter((bundle) => bundle.id !== bundleId)
        .map((bundle) => bundle.slug)
    );

    if (!usedSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let suffix = 2;
    let candidate = `${baseSlug}-${suffix}`;

    while (usedSlugs.has(candidate)) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((currentValue) =>
      currentValue.includes(productId)
        ? currentValue.filter((value) => value !== productId)
        : [...currentValue, productId]
    );
  };

  const handleImageUpload = async (file: File) => {
    if (!vendor) {
      throw new Error("No tienes una tienda creada");
    }

    setUploadingImage(true);

    try {
      const supabase = createClient();
      const { url } = await uploadProductImage(
        supabase,
        file,
        vendor.id,
        bundleId ? `bundle-${bundleId}` : "bundle-new"
      );

      setFeaturedImageUrl(url);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!vendor) {
      setError("No tienes una tienda creada");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError("Debes completar el titulo y la descripcion del bundle");
      return;
    }

    if (selectedProductIds.length < 2) {
      setError("Selecciona al menos 2 productos para crear un bundle");
      return;
    }

    if (bundlePriceCents > originalTotalCents) {
      setError("El precio del bundle debe ser menor o igual al valor total original");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const slug = await resolveUniqueSlug(title);
      const bundlePayload = {
        vendor_id: vendor.id,
        title: title.trim(),
        slug,
        short_description: shortDescription.trim() || null,
        description: description.trim(),
        price_cents: bundlePriceCents,
        featured_image_url: featuredImageUrl || null,
        is_active: isActive,
      };

      let savedBundleId = bundleId;

      if (bundleId) {
        const { error: updateError } = await supabase
          .from("bundles")
          .update(bundlePayload)
          .eq("id", bundleId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { data: insertedBundle, error: insertError } = await supabase
          .from("bundles")
          .insert([bundlePayload])
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        savedBundleId = insertedBundle.id;
      }

      if (!savedBundleId) {
        throw new Error("No se pudo guardar el bundle");
      }

      const { error: deleteError } = await supabase
        .from("bundle_products")
        .delete()
        .eq("bundle_id", savedBundleId);

      if (deleteError) {
        throw deleteError;
      }

      const { error: insertBundleProductsError } = await supabase.from("bundle_products").insert(
        selectedProductIds.map((productId, index) => ({
          bundle_id: savedBundleId,
          product_id: productId,
          sort_order: index,
        }))
      );

      if (insertBundleProductsError) {
        throw insertBundleProductsError;
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el bundle");
    } finally {
      setLoading(false);
    }
  };

  if (!initialized) {
    return <div className="text-center text-[var(--text-soft)]">Cargando...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error ? <div className="rounded-lg bg-red-500/10 p-4 text-red-400">{error}</div> : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Bundle</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Agrupa varios productos en una oferta clara con mejor valor comercial.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-white">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-white/10 bg-white/5"
            />
            Bundle activo
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-white">Titulo *</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="Pack Essential Rust Admin"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Descripcion corta</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(event) => setShortDescription(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="Resume el bundle en una frase"
              maxLength={160}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-[var(--text-soft)]">{shortDescription.length}/160</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-white">Descripcion *</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Explica por que estos productos encajan juntos y que problema resuelven."
            rows={5}
            disabled={loading}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Media</h2>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          Usa una portada clara para que el bundle se sienta como una oferta premium.
        </p>

        <div className="mt-5 space-y-4">
          {featuredImageUrl ? (
            <Image
              src={featuredImageUrl}
              alt="Bundle"
              width={1200}
              height={675}
              className="aspect-[16/9] w-full rounded-2xl object-cover"
            />
          ) : null}

          <FileUpload
            accept="image/*"
            maxSize={5 * 1024 * 1024}
            onFileSelected={handleImageUpload}
            isLoading={uploadingImage || loading}
            label="Subir portada del bundle"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Productos incluidos</h2>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          Selecciona al menos 2 productos aprobados de tu catalogo para construir el bundle.
        </p>

        <div className="mt-5 space-y-3">
          {products.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-[var(--text-soft)]">
              Necesitas al menos productos aprobados en tu catalogo para crear bundles.
            </div>
          ) : (
            products.map((product) => (
              <label
                key={product.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{product.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    EUR {(product.price_cents / 100).toFixed(2)}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(product.id)}
                  onChange={() => toggleProduct(product.id)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-white/10 bg-white/5"
                />
              </label>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Pricing</h2>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          Define un precio del bundle igual o inferior al valor total original.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-sm text-[var(--text-soft)]">Valor original</p>
            <p className="mt-2 text-2xl font-bold text-white">{originalTotalLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <label className="block text-sm text-[var(--text-soft)]">Precio bundle</label>
            <input
              type="number"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-sm text-[var(--text-soft)]">Ahorro del comprador</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">
              EUR {(savingsCents / 100).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={loading || uploadingImage || products.length === 0} className="w-full">
        {loading ? "Guardando..." : "Guardar bundle"}
      </Button>
    </form>
  );
}
