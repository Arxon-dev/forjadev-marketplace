"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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
  onSuccess: (savedProductId?: string) => void;
}

interface GameOption {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
}

interface VendorSummary {
  id: string;
}

interface LatestVersionSummary {
  version: string;
  fileName: string;
  createdAt: string;
}

interface ProductFaqFormItem {
  question: string;
  answer: string;
}

interface ProductGuideFormItem {
  title: string;
  body: string;
}

interface ProductCouponFormItem {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  isActive: boolean;
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
  const [supportPolicy, setSupportPolicy] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [updatePolicy, setUpdatePolicy] = useState("");
  const [price, setPrice] = useState("0");
  const [isFree, setIsFree] = useState(true);
  const [gameId, setGameId] = useState("");
  const [primaryCategoryId, setPrimaryCategoryId] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [games, setGames] = useState<GameOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [releaseVersion, setReleaseVersion] = useState("1.0.0");
  const [releaseChangelog, setReleaseChangelog] = useState("");
  const [releaseFile, setReleaseFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [latestVersion, setLatestVersion] = useState<LatestVersionSummary | null>(null);
  const [faqItems, setFaqItems] = useState<ProductFaqFormItem[]>([{ question: "", answer: "" }]);
  const [guideItems, setGuideItems] = useState<ProductGuideFormItem[]>([{ title: "", body: "" }]);
  const [couponItems, setCouponItems] = useState<ProductCouponFormItem[]>([
    {
      code: "",
      discountType: "percent",
      discountValue: "",
      startsAt: "",
      endsAt: "",
      maxRedemptions: "",
      isActive: true,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vendor, setVendor] = useState<VendorSummary | null>(null);

  const rootCategories = categories.filter((category) => category.parent_id === null);
  const selectedCategoryOptions = categories.filter((category) =>
    selectedCategoryIds.includes(category.id)
  );

  const resolveUniqueSlug = async (rawTitle: string) => {
    const supabase = createClient();
    const baseSlug = slugifyTitle(rawTitle) || `product-${Date.now()}`;

    const { data: existingProducts, error: slugError } = await supabase
      .from("products")
      .select("id, slug")
      .ilike("slug", `${baseSlug}%`);

    if (slugError) {
      throw slugError;
    }

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

      const [{ data: categoriesData }, { data: gamesData }] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, slug, parent_id, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("games")
          .select("id, name, slug, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      setCategories((categoriesData || []) as CategoryOption[]);
      setGames((gamesData || []) as GameOption[]);

      if (!productId && gamesData && gamesData.length > 0) {
        setGameId((currentValue) => currentValue || gamesData[0].id);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: vendorData } = await supabase
          .from("vendors")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (vendorData) {
          setVendor(vendorData as VendorSummary);
        }
      }

      if (!productId) {
        return;
      }

      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productData) {
        setTitle(productData.title);
        setDescription(productData.description || "");
        setShortDescription(productData.short_description || "");
        setSupportPolicy(productData.support_policy || "");
        setRefundPolicy(productData.refund_policy || "");
        setUpdatePolicy(productData.update_policy || "");
        setPrice((productData.price_cents / 100).toString());
        setIsFree(productData.is_free);
        setGameId(productData.game_id || "");
        setPrimaryCategoryId(productData.category_id || "");
        setFeaturedImageUrl(productData.featured_image_url || "");
      }

      const { data: productCategoryRows } = await supabase
        .from("product_categories")
        .select("category_id")
        .eq("product_id", productId);

      const { data: faqRows } = await supabase
        .from("product_faqs")
        .select("question, answer, sort_order")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      const { data: guideRows } = await supabase
        .from("product_guides")
        .select("title, body, sort_order")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      const { data: couponRows } = await supabase
        .from("coupons")
        .select(
          "code, discount_type, discount_value, starts_at, ends_at, max_redemptions, is_active, created_at"
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      const mappedCategoryIds = (productCategoryRows || []).map((row) => row.category_id);

      if (mappedCategoryIds.length > 0) {
        setSelectedCategoryIds(mappedCategoryIds);
        setPrimaryCategoryId((currentValue) => currentValue || mappedCategoryIds[0]);
      } else if (productData?.category_id) {
        setSelectedCategoryIds([productData.category_id]);
      }

      if (faqRows && faqRows.length > 0) {
        setFaqItems(
          faqRows.map((faq) => ({
            question: faq.question,
            answer: faq.answer,
          }))
        );
      }

      if (guideRows && guideRows.length > 0) {
        setGuideItems(
          guideRows.map((guide) => ({
            title: guide.title,
            body: guide.body,
          }))
        );
      }

      if (couponRows && couponRows.length > 0) {
        setCouponItems(
          couponRows.map((coupon) => ({
            code: coupon.code,
            discountType: coupon.discount_type,
            discountValue:
              coupon.discount_type === "fixed"
                ? (coupon.discount_value / 100).toFixed(2)
                : String(coupon.discount_value),
            startsAt: coupon.starts_at ? coupon.starts_at.slice(0, 16) : "",
            endsAt: coupon.ends_at ? coupon.ends_at.slice(0, 16) : "",
            maxRedemptions: coupon.max_redemptions ? String(coupon.max_redemptions) : "",
            isActive: coupon.is_active,
          }))
        );
      }

      const { data: versionRows } = await supabase
        .from("product_versions")
        .select("id, version, release_status, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(5);

      const versionData =
        (versionRows || []).find((version) => version.release_status === "active") ||
        (versionRows || [])[0];

      if (!versionData) {
        return;
      }

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
    };

    fetchData();
  }, [productId]);

  const toggleCategorySelection = (nextCategoryId: string, enabled: boolean) => {
    setSelectedCategoryIds((currentValue) => {
      const nextValue = enabled
        ? Array.from(new Set([...currentValue, nextCategoryId]))
        : currentValue.filter((categoryId) => categoryId !== nextCategoryId);

      setPrimaryCategoryId((currentPrimary) => {
        if (nextValue.length === 0) {
          return "";
        }

        if (currentPrimary && nextValue.includes(currentPrimary)) {
          return currentPrimary;
        }

        return nextValue[0];
      });

      return nextValue;
    });
  };

  const updateFaqItem = (
    index: number,
    field: keyof ProductFaqFormItem,
    value: string
  ) => {
    setFaqItems((currentValue) =>
      currentValue.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const addFaqItem = () => {
    setFaqItems((currentValue) => [...currentValue, { question: "", answer: "" }]);
  };

  const removeFaqItem = (index: number) => {
    setFaqItems((currentValue) => {
      const nextValue = currentValue.filter((_, itemIndex) => itemIndex !== index);
      return nextValue.length > 0 ? nextValue : [{ question: "", answer: "" }];
    });
  };

  const updateGuideItem = (
    index: number,
    field: keyof ProductGuideFormItem,
    value: string
  ) => {
    setGuideItems((currentValue) =>
      currentValue.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const addGuideItem = () => {
    setGuideItems((currentValue) => [...currentValue, { title: "", body: "" }]);
  };

  const removeGuideItem = (index: number) => {
    setGuideItems((currentValue) => {
      const nextValue = currentValue.filter((_, itemIndex) => itemIndex !== index);
      return nextValue.length > 0 ? nextValue : [{ title: "", body: "" }];
    });
  };

  const updateCouponItem = (
    index: number,
    field: keyof ProductCouponFormItem,
    value: string | boolean
  ) => {
    setCouponItems((currentValue) =>
      currentValue.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const addCouponItem = () => {
    setCouponItems((currentValue) => [
      ...currentValue,
      {
        code: "",
        discountType: "percent",
        discountValue: "",
        startsAt: "",
        endsAt: "",
        maxRedemptions: "",
        isActive: true,
      },
    ]);
  };

  const removeCouponItem = (index: number) => {
    setCouponItems((currentValue) => {
      const nextValue = currentValue.filter((_, itemIndex) => itemIndex !== index);
      return nextValue.length > 0
        ? nextValue
        : [
            {
              code: "",
              discountType: "percent",
              discountValue: "",
              startsAt: "",
              endsAt: "",
              maxRedemptions: "",
              isActive: true,
            },
          ];
    });
  };

  const handleImageUpload = async (file: File) => {
    if (!vendor) {
      throw new Error("No tienes una tienda creada");
    }

    setUploadingImage(true);

    try {
      const supabase = createClient();
      const { url } = await uploadProductImage(supabase, file, vendor.id, productId || "new");

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

    if (!gameId) {
      setError("Debes seleccionar un juego para el producto");
      return;
    }

    if (selectedCategoryIds.length === 0) {
      setError("Debes seleccionar al menos una categoria");
      return;
    }

    if (!productId && !releaseFile) {
      setError("Debes subir un ZIP para crear el producto");
      return;
    }

    if ((!productId || releaseFile) && !releaseVersion.trim()) {
      setError("Debes indicar una version para el archivo descargable");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No autenticado");
      }

      if (!vendor) {
        throw new Error("No tienes una tienda creada");
      }

      const slug = await resolveUniqueSlug(title);

      const productData = {
        vendor_id: vendor.id,
        title,
        slug,
        short_description: shortDescription,
        description,
        support_policy: supportPolicy.trim() || null,
        refund_policy: refundPolicy.trim() || null,
        update_policy: updatePolicy.trim() || null,
        price_cents: isFree ? 0 : Math.round(parseFloat(price) * 100),
        is_free: isFree,
        game_id: gameId,
        category_id: primaryCategoryId || selectedCategoryIds[0] || null,
        featured_image_url: featuredImageUrl || null,
        moderation_status: "pending" as const,
      };

      let savedProductId = productId;

      if (productId) {
        const { error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { data: insertedProduct, error: insertError } = await supabase
          .from("products")
          .insert([productData])
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        savedProductId = insertedProduct.id;
      }

      if (!savedProductId) {
        throw new Error("No se pudo resolver el producto guardado");
      }

      const { data: existingProductCategories, error: existingCategoriesError } = await supabase
        .from("product_categories")
        .select("category_id")
        .eq("product_id", savedProductId);

      if (existingCategoriesError) {
        throw existingCategoriesError;
      }

      const existingCategoryIds = new Set(
        (existingProductCategories || []).map((item) => item.category_id)
      );
      const nextCategoryIds = new Set(selectedCategoryIds);
      const categoryIdsToInsert = selectedCategoryIds.filter(
        (selectedId) => !existingCategoryIds.has(selectedId)
      );
      const categoryIdsToDelete = Array.from(existingCategoryIds).filter(
        (existingId) => !nextCategoryIds.has(existingId)
      );

      if (categoryIdsToInsert.length > 0) {
        const { error: insertCategoriesError } = await supabase
          .from("product_categories")
          .insert(
            categoryIdsToInsert.map((selectedId) => ({
              product_id: savedProductId,
              category_id: selectedId,
            }))
          );

        if (insertCategoriesError) {
          throw insertCategoriesError;
        }
      }

      if (categoryIdsToDelete.length > 0) {
        const { error: deleteCategoriesError } = await supabase
          .from("product_categories")
          .delete()
          .eq("product_id", savedProductId)
          .in("category_id", categoryIdsToDelete);

        if (deleteCategoriesError) {
          throw deleteCategoriesError;
        }
      }

      const normalizedFaqItems = faqItems
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
        .filter((item) => item.question && item.answer);

      const { error: deleteFaqsError } = await supabase
        .from("product_faqs")
        .delete()
        .eq("product_id", savedProductId);

      if (deleteFaqsError) {
        throw deleteFaqsError;
      }

      if (normalizedFaqItems.length > 0) {
        const { error: insertFaqsError } = await supabase.from("product_faqs").insert(
          normalizedFaqItems.map((item, index) => ({
            product_id: savedProductId,
            question: item.question,
            answer: item.answer,
            sort_order: index,
          }))
        );

        if (insertFaqsError) {
          throw insertFaqsError;
        }
      }

      const normalizedGuideItems = guideItems
        .map((item) => ({
          title: item.title.trim(),
          body: item.body.trim(),
        }))
        .filter((item) => item.title && item.body);

      const { error: deleteGuidesError } = await supabase
        .from("product_guides")
        .delete()
        .eq("product_id", savedProductId);

      if (deleteGuidesError) {
        throw deleteGuidesError;
      }

      if (normalizedGuideItems.length > 0) {
        const { error: insertGuidesError } = await supabase.from("product_guides").insert(
          normalizedGuideItems.map((item, index) => ({
            product_id: savedProductId,
            title: item.title,
            body: item.body,
            sort_order: index,
          }))
        );

        if (insertGuidesError) {
          throw insertGuidesError;
        }
      }

      const normalizedCoupons = couponItems
        .map((item) => ({
          code: item.code.trim().toUpperCase(),
          discount_type: item.discountType,
          discount_value:
            item.discountType === "fixed"
              ? Math.round(parseFloat(item.discountValue || "0") * 100)
              : Math.round(parseFloat(item.discountValue || "0")),
          starts_at: item.startsAt ? new Date(item.startsAt).toISOString() : null,
          ends_at: item.endsAt ? new Date(item.endsAt).toISOString() : null,
          max_redemptions: item.maxRedemptions ? parseInt(item.maxRedemptions, 10) : null,
          is_active: item.isActive,
        }))
        .filter((item) => item.code && item.discount_value > 0);

      const { error: deleteCouponsError } = await supabase
        .from("coupons")
        .delete()
        .eq("product_id", savedProductId);

      if (deleteCouponsError) {
        throw deleteCouponsError;
      }

      if (normalizedCoupons.length > 0) {
        const { error: insertCouponsError } = await supabase.from("coupons").insert(
          normalizedCoupons.map((coupon) => ({
            vendor_id: vendor.id,
            product_id: savedProductId,
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            starts_at: coupon.starts_at,
            ends_at: coupon.ends_at,
            max_redemptions: coupon.max_redemptions,
            is_active: coupon.is_active,
          }))
        );

        if (insertCouponsError) {
          throw insertCouponsError;
        }
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

        if (versionError) {
          throw versionError;
        }

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

          if (fileRecordError) {
            throw fileRecordError;
          }
        } catch (releaseError) {
          if (uploadedFilePath) {
            await deleteProductFile(supabase, uploadedFilePath).catch(() => undefined);
          }

          await supabase.from("product_versions").delete().eq("id", insertedVersion.id);
          throw releaseError;
        }
      }

      onSuccess(savedProductId);
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
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

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
        {featuredImageUrl ? (
          <div className="mt-4">
            <Image
              src={featuredImageUrl}
              alt="Imagen destacada"
              width={128}
              height={128}
              className="h-32 w-32 rounded-lg object-cover"
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {productId ? "Nueva version descargable" : "Archivo descargable"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {productId
                ? "Sube un nuevo ZIP para publicar una version adicional de tu producto."
                : "Sube el ZIP principal que los usuarios descargaran."}
            </p>
          </div>
          {latestVersion ? (
            <div className="text-right text-xs text-[var(--text-soft)]">
              <p>Ultima version: {latestVersion.version}</p>
              <p>{latestVersion.fileName}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-white">Version *</label>
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
            placeholder="Resume que incluye esta version"
            rows={4}
            disabled={loading}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Cupones</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Crea descuentos por producto para lanzamientos, promociones puntuales o comunidad.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={addCouponItem} disabled={loading}>
            Anadir cupon
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {couponItems.map((item, index) => (
            <div key={`coupon-${index}`} className="rounded-2xl border border-white/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-white">Cupon {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeCouponItem(index)}
                  disabled={loading || couponItems.length === 1}
                >
                  Eliminar
                </Button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-white">Codigo</label>
                  <input
                    type="text"
                    value={item.code}
                    onChange={(e) => updateCouponItem(index, "code", e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    placeholder="PROMO10"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">Tipo de descuento</label>
                  <select
                    value={item.discountType}
                    onChange={(e) =>
                      updateCouponItem(index, "discountType", e.target.value as "percent" | "fixed")
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                    disabled={loading}
                  >
                    <option value="percent">Porcentaje</option>
                    <option value="fixed">Importe fijo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">
                    {item.discountType === "fixed" ? "Descuento en EUR" : "Descuento en %"}
                  </label>
                  <input
                    type="number"
                    value={item.discountValue}
                    onChange={(e) => updateCouponItem(index, "discountValue", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    placeholder={item.discountType === "fixed" ? "5.00" : "10"}
                    step={item.discountType === "fixed" ? "0.01" : "1"}
                    min="0"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">Maximo de usos</label>
                  <input
                    type="number"
                    value={item.maxRedemptions}
                    onChange={(e) => updateCouponItem(index, "maxRedemptions", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    placeholder="Sin limite"
                    min="1"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">Inicio</label>
                  <input
                    type="datetime-local"
                    value={item.startsAt}
                    onChange={(e) => updateCouponItem(index, "startsAt", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">Fin</label>
                  <input
                    type="datetime-local"
                    value={item.endsAt}
                    onChange={(e) => updateCouponItem(index, "endsAt", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                    disabled={loading}
                  />
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm font-medium text-white">
                <input
                  type="checkbox"
                  checked={item.isActive}
                  onChange={(e) => updateCouponItem(index, "isActive", e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-white/10 bg-white/5"
                />
                Cupon activo
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Guias y tutoriales</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Acompana la compra con instrucciones claras de instalacion, configuracion y uso.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={addGuideItem} disabled={loading}>
            Anadir guia
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {guideItems.map((item, index) => (
            <div key={`guide-${index}`} className="rounded-2xl border border-white/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-white">Guia {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeGuideItem(index)}
                  disabled={loading || guideItems.length === 1}
                >
                  Eliminar
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white">Titulo</label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateGuideItem(index, "title", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    placeholder="Ejemplo: Instalacion rapida"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">Contenido</label>
                  <textarea
                    value={item.body}
                    onChange={(e) => updateGuideItem(index, "body", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    placeholder="Describe pasos, comandos, notas de configuracion y recomendaciones."
                    rows={5}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white">Titulo *</label>
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
        <label className="block text-sm font-medium text-white">Descripcion corta</label>
        <input
          type="text"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          placeholder="Una linea que resuma tu producto"
          maxLength={160}
          disabled={loading}
        />
        <p className="mt-1 text-xs text-[var(--text-soft)]">{shortDescription.length}/160</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white">Descripcion *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          placeholder="Descripcion detallada del producto"
          rows={6}
          disabled={loading}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Trust y soporte</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            Define expectativas claras para compradores y reduce friccion antes de la compra.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white">Politica de soporte</label>
            <textarea
              value={supportPolicy}
              onChange={(e) => setSupportPolicy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="Ejemplo: Respondo tickets en 24-48h laborables y doy soporte de instalacion."
              rows={3}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Politica de reembolso</label>
            <textarea
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="Ejemplo: Reembolsos solo si el producto no funciona segun la descripcion y no hay solucion razonable."
              rows={3}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Politica de actualizaciones</label>
            <textarea
              value={updatePolicy}
              onChange={(e) => setUpdatePolicy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="Ejemplo: Incluye updates para el wipe actual y compatibilidad con cambios mayores de Rust."
              rows={3}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Preguntas frecuentes</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Responde dudas recurrentes para aumentar conversion y reducir soporte repetitivo.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={addFaqItem} disabled={loading}>
            Anadir FAQ
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {faqItems.map((item, index) => (
            <div key={`faq-${index}`} className="rounded-2xl border border-white/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-white">FAQ {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeFaqItem(index)}
                  disabled={loading || faqItems.length === 1}
                >
                  Eliminar
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white">Pregunta</label>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateFaqItem(index, "question", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    placeholder="Ejemplo: Incluye configuracion editable?"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">Respuesta</label>
                  <textarea
                    value={item.answer}
                    onChange={(e) => updateFaqItem(index, "answer", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                    placeholder="Explica la respuesta de forma clara y operativa."
                    rows={3}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-white">Juego *</label>
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
            disabled={loading}
          >
            <option value="">Seleccionar juego...</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
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
          {!isFree ? (
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
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Categorias</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Selecciona una categoria principal y, si encaja, subcategorias adicionales para
              mejorar el discovery del producto.
            </p>
          </div>
          <div className="text-right text-xs text-[var(--text-soft)]">
            <p>{selectedCategoryIds.length} categorias seleccionadas</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {rootCategories.map((rootCategory) => {
            const childCategories = categories.filter(
              (category) => category.parent_id === rootCategory.id
            );

            return (
              <div key={rootCategory.id} className="rounded-2xl border border-white/10 p-4">
                <label className="flex items-center gap-3 text-sm font-medium text-white">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(rootCategory.id)}
                    onChange={(e) =>
                      toggleCategorySelection(rootCategory.id, e.target.checked)
                    }
                    disabled={loading}
                    className="h-4 w-4 rounded border-white/10 bg-white/5"
                  />
                  {rootCategory.name}
                </label>

                {childCategories.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {childCategories.map((childCategory) => (
                      <label
                        key={childCategory.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-soft)]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(childCategory.id)}
                          onChange={(e) =>
                            toggleCategorySelection(childCategory.id, e.target.checked)
                          }
                          disabled={loading}
                          className="h-4 w-4 rounded border-white/10 bg-white/5"
                        />
                        {childCategory.name}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {selectedCategoryOptions.length > 0 ? (
          <div className="mt-5">
            <label className="block text-sm font-medium text-white">Categoria principal *</label>
            <select
              value={primaryCategoryId}
              onChange={(e) => setPrimaryCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
              disabled={loading}
            >
              {selectedCategoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
