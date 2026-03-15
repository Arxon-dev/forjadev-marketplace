"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteProductFile,
  uploadProductFile,
  uploadProductImage,
} from "@/lib/supabase/storage";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";

interface ProductFormProps {
  productId?: string;
  onSuccess: () => void;
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

export function ProductForm({ productId, onSuccess }: ProductFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [isFree, setIsFree] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [releaseVersion, setReleaseVersion] = useState("1.0.0");
  const [releaseChangelog, setReleaseChangelog] = useState("");
  const [releaseFile, setReleaseFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [latestVersion, setLatestVersion] = useState<{
    version: string;
    fileName: string;
    createdAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vendor, setVendor] = useState<any>(null);

  const resolveUniqueSlug = async (rawTitle: string) => {
    const supabase = createClient();
    const baseSlug = slugifyTitle(rawTitle) || `product-${Date.now()}`;

    const { data: existingProducts, error: slugError } = await supabase
      .from("products")
      .select("id, slug")
      .ilike("slug", `${baseSlug}%`);

    if (slugError) throw slugError;

    const usedSlugs = new Set(
      (existingProducts || [])
        .filter((product) => product.id !== productId)
        .map((product) => product.slug)
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

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      
      // Obtiene categorías
      const { data: categoriesData } = await supabase.from("categories").select("*");
      setCategories(categoriesData || []);

      // Obtiene vendor del usuario
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: vendorData } = await supabase
          .from("vendors")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (vendorData) setVendor(vendorData);
      }

      // Si es edición, carga los datos del producto
      if (productId) {
        const { data: productData } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single();

        if (productData) {
          setTitle(productData.title);
          setDescription(productData.description);
          setShortDescription(productData.short_description);
          setPrice((productData.price_cents / 100).toString());
          setIsFree(productData.is_free);
          setCategoryId(productData.category_id || "");
          setFeaturedImageUrl(productData.featured_image_url || "");
        }

        const { data: versionData } = await supabase
          .from("product_versions")
          .select("id, version, created_at")
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (versionData) {
          const { data: fileData } = await supabase
            .from("product_files")
            .select("file_name")
            .eq("product_version_id", versionData.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          setLatestVersion({
            version: versionData.version,
            fileName: fileData?.file_name || "Archivo disponible",
            createdAt: versionData.created_at,
          });
        }
      }
    };

    fetchData();
  }, [productId]);

  const handleImageUpload = async (file: File) => {
    if (!vendor) throw new Error("No tienes una tienda creada");

    setUploadingImage(true);
    try {
      const supabase = createClient();
      const { url } = await uploadProductImage(
        supabase,
        file,
        vendor.id,
        productId || "new"
      );
      setFeaturedImageUrl(url);
      setUploadingImage(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error al subir imagen";
      setError(errorMessage);
      setUploadingImage(false);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title || !description) {
      setError("Por favor completa todos los campos requeridos");
      return;
    }

    if (!productId && !releaseFile) {
      setError("Debes subir un ZIP para crear el producto");
      return;
    }

    if ((!productId || releaseFile) && !releaseVersion.trim()) {
      setError("Debes indicar una versión para el archivo descargable");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("No autenticado");

      if (!vendor) throw new Error("No tienes una tienda creada");

      const slug = await resolveUniqueSlug(title);

      const productData = {
        vendor_id: vendor.id,
        title,
        slug,
        short_description: shortDescription,
        description,
        price_cents: isFree ? 0 : Math.round(parseFloat(price) * 100),
        is_free: isFree,
        category_id: categoryId || null,
        featured_image_url: featuredImageUrl || null,
        moderation_status: "pending",
      };

      let savedProductId = productId;

      if (productId) {
        // Actualiza producto existente
        const { error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId);

        if (updateError) throw updateError;
      } else {
        // Crea nuevo producto
        const { data: insertedProduct, error: insertError } = await supabase
          .from("products")
          .insert([productData])
          .select("id")
          .single();

        if (insertError) throw insertError;
        savedProductId = insertedProduct.id;
      }

      if (!savedProductId) {
        throw new Error("No se pudo resolver el producto guardado");
      }

      if (releaseFile) {
        setUploadingFile(true);

        const { data: insertedVersion, error: versionError } = await supabase
          .from("product_versions")
          .insert([
            {
              product_id: savedProductId,
              version: releaseVersion.trim(),
              changelog: releaseChangelog.trim() || null,
            },
          ])
          .select("id")
          .single();

        if (versionError) throw versionError;

        let uploadedFilePath: string | null = null;

        try {
          const uploadedFile = await uploadProductFile(
            supabase,
            releaseFile,
            vendor.id,
            savedProductId,
            insertedVersion.id
          );

          uploadedFilePath = uploadedFile.path;

          const { error: fileRecordError } = await supabase.from("product_files").insert([
            {
              product_version_id: insertedVersion.id,
              storage_path: uploadedFile.path,
              file_name: releaseFile.name,
              file_size_bytes: uploadedFile.size,
            },
          ]);

          if (fileRecordError) throw fileRecordError;
        } catch (releaseError) {
          if (uploadedFilePath) {
            await deleteProductFile(supabase, uploadedFilePath).catch(() => undefined);
          }

          await supabase.from("product_versions").delete().eq("id", insertedVersion.id);

          throw releaseError;
        }
      }

      onSuccess();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al guardar el producto";
      setError(errorMessage);
    } finally {
      setUploadingFile(false);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-white">Imagen destacada</label>
        <div className="mt-2">
          <FileUpload
            onFileSelected={handleImageUpload}
            accept="image/*"
            maxSize={5 * 1024 * 1024}
            label="Seleccionar imagen"
            isLoading={uploadingImage}
            successMessage="Imagen subida correctamente"
          />
        </div>
        {featuredImageUrl && (
          <div className="mt-4">
            <Image
              src={featuredImageUrl}
              alt="Imagen destacada"
              width={128}
              height={128}
              className="h-32 w-32 rounded-lg object-cover"
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {productId ? "Nueva versión descargable" : "Archivo descargable"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {productId
                ? "Sube un nuevo ZIP para publicar una versión adicional de tu producto."
                : "Sube el ZIP principal que los usuarios descargarán."}
            </p>
          </div>
          {latestVersion ? (
            <div className="text-right text-xs text-[var(--text-soft)]">
              <p>Última versión: {latestVersion.version}</p>
              <p>{latestVersion.fileName}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-white">Versión *</label>
            <input
              type="text"
              value={releaseVersion}
              onChange={(e) => setReleaseVersion(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="1.0.0"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white">ZIP del producto *</label>
            <div className="mt-1">
              <FileUpload
                onFileSelected={async (file) => {
                  setReleaseFile(file);
                }}
                accept=".zip,application/zip,application/x-zip-compressed"
                maxSize={100 * 1024 * 1024}
                label={releaseFile ? "Cambiar ZIP" : "Seleccionar ZIP"}
                isLoading={uploadingFile}
                autoClearOnSuccess={false}
                successMessage="ZIP listo para guardar con el producto"
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-white">Changelog</label>
          <textarea
            value={releaseChangelog}
            onChange={(e) => setReleaseChangelog(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Resume qué incluye esta versión"
            rows={4}
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white">Título *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          placeholder="Nombre del producto"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white">
          Descripción corta
        </label>
        <input
          type="text"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          placeholder="Una línea que resuma tu producto"
          maxLength={160}
          disabled={loading}
        />
        <p className="mt-1 text-xs text-[var(--text-soft)]">
          {shortDescription.length}/160
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white">
          Descripción *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          placeholder="Descripción detallada del producto"
          rows={6}
          disabled={loading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-white">Categoría</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
            disabled={loading}
          >
            <option value="">Seleccionar categoría...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-white">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-white/10 bg-white/5"
            />
            Es gratis
          </label>
          {!isFree && (
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="0.00"
              step="0.01"
              min="0"
              disabled={loading}
            />
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || uploadingImage || uploadingFile}
        className="w-full"
      >
        {loading ? "Guardando..." : "Guardar producto"}
      </Button>
    </form>
  );
}
