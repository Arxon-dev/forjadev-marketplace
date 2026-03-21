import type { Metadata } from "next";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/downloads/download-button";
import { ProductCollectionButton } from "@/components/community/product-collection-button";
import { DiscussionThreadForm } from "@/components/community/discussion-thread-form";
import { ProductCommerceHelpPanel } from "@/components/help/product-commerce-help-panel";
import { WishlistButton } from "@/components/community/wishlist-button";
import { CommerceSectionHeading, CommerceStage } from "@/components/marketplace/commerce-surface-system";
import { ProductCompositionPanel } from "@/components/marketplace/product-composition-panel";
import { ProductCard } from "@/components/marketplace/product-card";
import { ShoppingQualitySummary } from "@/components/marketplace/shopping-quality-summary";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { ReviewForm } from "@/components/reviews/review-form";
import { Badge } from "@/components/ui/badge";
import { getProductCommerceHelpContext } from "@/lib/help/public";
import { getProductCompositionOptions } from "@/lib/commerce/product-composition";
import { getSimilarProducts, getUsersAlsoBoughtProducts } from "@/lib/intelligence/recommendations";
import { buildShoppingQualitySnapshot } from "@/lib/marketplace/quality-signals";
import { buildDiscussionTrustSnapshot } from "@/lib/community/discussion-trust";
import { getPublicDealsForProducts } from "@/lib/promotions/public";
import { buildPublicMetadata } from "@/lib/seo/public-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPublicSellerProfile } from "@/lib/sellers/public";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ coupon?: string }>;
}

interface RelatedProductRow {
  id: string;
  vendor_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  price_cents: number;
  is_free: boolean;
  compatibility: string | null;
  featured_image_url: string | null;
  rating_average: number;
  rating_count: number;
}

interface DiscussionRow {
  id: string;
  author_user_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface DiscussionMessageRow {
  discussion_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
}

interface ProfileLookupRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

interface UserCollectionRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  updated_at: string;
}

interface CollectionItemLookupRow {
  collection_id: string;
  product_id: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(
      "title, slug, short_description, description, moderation_status, category_id, game_id"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!product) {
    return buildPublicMetadata({
      title: "Producto no disponible",
      description: "El producto solicitado no esta disponible en el catalogo publico.",
      path: `/products/${slug}`,
      index: false,
    });
  }

  const [{ data: category }, { data: game }] = await Promise.all([
    product.category_id
      ? supabase.from("categories").select("name").eq("id", product.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    product.game_id
      ? supabase.from("games").select("name").eq("id", product.game_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const contextualDescription =
    product.short_description ||
    product.description ||
    `Explora ${product.title}${game?.name ? ` para ${game.name}` : ""}${category?.name ? ` dentro de ${category.name}` : ""} en ForjaDev Marketplace.`;

  return buildPublicMetadata({
    title: product.title,
    description: contextualDescription,
    path: `/products/${product.slug}`,
    index: product.moderation_status === "approved",
  });
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, slug, short_description, description, support_policy, refund_policy, update_policy, price_cents, is_free, moderation_status, featured_image_url, vendor_id, rejection_reason, compatibility, created_at, updated_at, category_id, game_id, rating_average, rating_count"
    )
    .eq("slug", slug)
    .single();

  if (!product) {
    notFound();
  }

  const [{ data: vendor }, { data: profile }, { data: category }, { data: game }] =
    await Promise.all([
      supabase
        .from("vendors")
        .select("id, user_id, store_name, slug, bio")
        .eq("id", product.vendor_id)
        .single(),
      user
        ? supabase.from("profiles").select("role").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
      product.category_id
        ? supabase
            .from("categories")
            .select("id, name, slug, parent_id")
            .eq("id", product.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      product.game_id
        ? supabase.from("games").select("id, name, slug").eq("id", product.game_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const sellerProfile =
    vendor?.slug ? await getPublicSellerProfile(supabase, adminSupabase, vendor.slug) : null;
  const activeDeal =
    (
      await getPublicDealsForProducts([
        {
          id: product.id,
          price_cents: product.price_cents,
          is_free: product.is_free,
        },
      ])
    ).get(product.id) || null;

  const parentCategory =
    category?.parent_id
      ? (
          await supabase
            .from("categories")
            .select("id, name, slug")
            .eq("id", category.parent_id)
            .maybeSingle()
        ).data
      : null;

  const { data: versions } = await supabase
    .from("product_versions")
    .select("id, version, changelog, created_at, release_status")
    .eq("product_id", product.id)
    .in("release_status", ["active", "historical"])
    .order("created_at", { ascending: false });

  const { data: faqs } = await supabase
    .from("product_faqs")
    .select("id, question, answer, sort_order")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: guides } = await supabase
    .from("product_guides")
    .select("id, title, body, sort_order")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const productCommerceHelpContext = await getProductCommerceHelpContext(supabase, product.id, 2, 2);
  const productCompositionBundles = await getProductCompositionOptions(product.id);

  const { data: discussions } = await supabase
    .from("product_discussions")
    .select("id, author_user_id, title, body, is_pinned, is_locked, created_at, updated_at")
    .eq("product_id", product.id)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(8);

  const versionIds = (versions || []).map((version) => version.id);
  const { data: versionFiles } =
    versionIds.length > 0
      ? await supabase
          .from("product_files")
          .select("product_version_id")
          .in("product_version_id", versionIds)
      : { data: [] as { product_version_id: string }[] };

  const downloadableVersionIds = new Set(
    (versionFiles || []).map((file) => file.product_version_id)
  );

  const latestVersion =
    versions?.find(
      (version) => version.release_status === "active" && downloadableVersionIds.has(version.id)
    ) ||
    versions?.find((version) => downloadableVersionIds.has(version.id)) ||
    versions?.[0] ||
    null;

  const isOwner = Boolean(user && vendor?.user_id === user.id);
  const isAdmin = profile?.role === "admin";

  let hasPurchase = false;
  let hasDownload = false;
  let hasActiveLicense = false;
  let hasAnyLicense = false;

  if (user && !isOwner && !isAdmin) {
    if (product.is_free) {
      const { data: download } = await supabase
        .from("downloads")
        .select("id")
        .eq("product_id", product.id)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      hasDownload = Boolean(download);
    } else {
      const { data: purchase } = await supabase
        .from("order_items")
        .select("id, order:orders!inner(status, user_id)")
        .eq("product_id", product.id)
        .eq("order.user_id", user.id)
        .eq("order.status", "completed")
        .limit(1)
        .maybeSingle();

      hasPurchase = Boolean(purchase);

      if (hasPurchase) {
        const { data: licenses } = await supabase
          .from("licenses")
          .select("id, status")
          .eq("product_id", product.id)
          .eq("user_id", user.id);

        hasAnyLicense = Boolean(licenses && licenses.length > 0);
        hasActiveLicense = Boolean(
          licenses && licenses.some((license) => license.status === "active")
        );
      }
    }
  }

  const hasRevokedLicense = hasAnyLicense && !hasActiveLicense;

  const canDownload = Boolean(
    user &&
      (product.is_free ||
        isOwner ||
        isAdmin ||
        (hasPurchase && (!hasAnyLicense || hasActiveLicense)))
  );

  const canReview = Boolean(
    user &&
      !isOwner &&
      !isAdmin &&
      product.moderation_status === "approved" &&
      ((product.is_free && hasDownload) || (!product.is_free && hasPurchase))
  );

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, user_id, rating, title, body, created_at")
    .eq("product_id", product.id)
    .order("created_at", { ascending: false });

  const existingReview = user
    ? (reviews || []).find((review) => review.user_id === user.id) || null
    : null;

  const discussionRows = (discussions || []) as DiscussionRow[];
  const discussionIds = discussionRows.map((discussion) => discussion.id);
  const discussionAuthorIds = Array.from(
    new Set(discussionRows.map((discussion) => discussion.author_user_id))
  );

  const [{ data: discussionMessages }, { data: discussionProfiles }] = await Promise.all([
    discussionIds.length > 0
      ? supabase
          .from("discussion_messages")
          .select("discussion_id, author_user_id, body, created_at")
          .in("discussion_id", discussionIds)
      : Promise.resolve({ data: [] as DiscussionMessageRow[] }),
    discussionAuthorIds.length > 0
      ? adminSupabase
          .from("profiles")
          .select("id, username, display_name, email")
          .in("id", discussionAuthorIds)
      : Promise.resolve({ data: [] as ProfileLookupRow[] }),
  ]);

  const discussionMessagesById = new Map<string, DiscussionMessageRow[]>();
  ((discussionMessages || []) as DiscussionMessageRow[]).forEach((message) => {
    const current = discussionMessagesById.get(message.discussion_id) || [];
    current.push(message);
    discussionMessagesById.set(message.discussion_id, current);
  });

  const discussionProfileById = new Map(
    ((discussionProfiles || []) as ProfileLookupRow[]).map((profile) => [profile.id, profile])
  );

  const [{ count: wishlistCount }, wishlistEntryResult, userCollectionsResult] = await Promise.all([
    adminSupabase
      .from("wishlists")
      .select("*", { count: "exact", head: true })
      .eq("product_id", product.id),
    user
      ? supabase
          .from("wishlists")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("collections")
          .select("id, title, slug, description, is_public, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] as UserCollectionRow[] }),
  ]);

  const isWishlisted = Boolean(wishlistEntryResult.data);
  const userCollections = (userCollectionsResult.data || []) as UserCollectionRow[];
  const userCollectionIds = userCollections.map((collection) => collection.id);

  const { data: userCollectionItemsData } =
    userCollectionIds.length > 0
      ? await supabase
          .from("collection_items")
          .select("collection_id, product_id")
          .in("collection_id", userCollectionIds)
      : { data: [] as CollectionItemLookupRow[] };

  const userCollectionItemCounts = new Map<string, number>();
  const includedCollectionIds = new Set<string>();
  ((userCollectionItemsData || []) as CollectionItemLookupRow[]).forEach((item) => {
    userCollectionItemCounts.set(
      item.collection_id,
      (userCollectionItemCounts.get(item.collection_id) || 0) + 1
    );

    if (item.product_id === product.id) {
      includedCollectionIds.add(item.collection_id);
    }
  });

  const averageRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null;

  const sellerProductsPromise = supabase
    .from("products")
    .select(
      "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count"
    )
    .eq("moderation_status", "approved")
    .eq("vendor_id", product.vendor_id)
    .neq("id", product.id)
    .order("updated_at", { ascending: false })
    .limit(3);

  const [similarProductsResult, alsoBoughtProductsResult, sellerProductsResult] = await Promise.all([
    getSimilarProducts(
      {
        id: product.id,
        categoryId: product.category_id,
        gameId: product.game_id,
      },
      3
    ),
    getUsersAlsoBoughtProducts(product.id, 3),
    sellerProductsPromise,
  ]);

  const seenLoopProductIds = new Set<string>();
  const similarProducts = (similarProductsResult || []).filter((item) => {
    if (seenLoopProductIds.has(item.id)) {
      return false;
    }

    seenLoopProductIds.add(item.id);
    return true;
  }) as RelatedProductRow[];
  const alsoBoughtProducts = (alsoBoughtProductsResult || []).filter((item) => {
    if (seenLoopProductIds.has(item.id)) {
      return false;
    }

    seenLoopProductIds.add(item.id);
    return true;
  }) as RelatedProductRow[];
  const sellerProducts = ((sellerProductsResult.data || []) as RelatedProductRow[]).filter((item) => {
    if (seenLoopProductIds.has(item.id)) {
      return false;
    }

    seenLoopProductIds.add(item.id);
    return true;
  });
  const loopProducts = [...similarProducts, ...alsoBoughtProducts, ...sellerProducts];
  const loopDealsByProductId = await getPublicDealsForProducts(loopProducts);
  const vendorIds = Array.from(new Set(loopProducts.map((item) => item.vendor_id)));
  const categoryIds = Array.from(
    new Set(loopProducts.map((item) => item.category_id).filter(Boolean))
  );

  const [vendorsResult, categoriesResult] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; store_name: string }> }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const vendorById = new Map(
    (vendorsResult.data || []).map((item) => [item.id, item.store_name])
  );
  const categoryById = new Map(
    (categoriesResult.data || []).map((item) => [item.id, item.name])
  );
  const appliedCouponCode =
    activeDeal?.source === "coupon" && activeDeal.code ? activeDeal.code : resolvedSearchParams.coupon;
  const checkoutHref = `/checkout/${product.id}${
    appliedCouponCode ? `?coupon=${encodeURIComponent(appliedCouponCode)}` : ""
  }`;
  const shoppingQualitySnapshot = buildShoppingQualitySnapshot({
    ratingAverage: averageRating ?? product.rating_average,
    ratingCount: reviews?.length || product.rating_count || 0,
    supportPolicy: product.support_policy,
    refundPolicy: product.refund_policy,
    updatePolicy: product.update_policy,
    lastUpdatedAt:
      latestVersion?.created_at || sellerProfile?.metrics.latestProductUpdateAt || product.updated_at,
    sellerApprovedProducts: sellerProfile?.metrics.approvedProducts || 0,
    sellerTotalPurchases: sellerProfile?.metrics.totalPurchases || 0,
    sellerIdentityVerified: sellerProfile?.identityVerification.isVerified || false,
  });

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="product.detail.opened"
        pageType="product_detail"
        entityType="product"
        entityId={product.id}
        metadata={{
          slug: product.slug,
          category: category?.slug || null,
          game: game?.slug || null,
        }}
      />
      <section className="container-shell py-16">
        <CommerceStage
          dataId="product-stage"
          eyebrow="Producto"
          title={product.title}
          description={
            product.short_description ||
            "Ficha comercial preparada para evaluar valor, confianza, soporte y decision de compra."
          }
          surface="context"
          path={
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
              <Link href="/products" className="hover:text-white">
                Productos
              </Link>
              {game ? (
                <>
                  <span>/</span>
                  <Link href={`/games/${game.slug}`} className="hover:text-white">
                    {game.name}
                  </Link>
                </>
              ) : null}
              {parentCategory ? (
                <>
                  <span>/</span>
                  <Link href={`/categories/${parentCategory.slug}`} className="hover:text-white">
                    {parentCategory.name}
                  </Link>
                </>
              ) : null}
              {category ? (
                <>
                  <span>/</span>
                  <Link href={`/categories/${category.slug}`} className="hover:text-white">
                    {category.name}
                  </Link>
                </>
              ) : null}
              <span>/</span>
              <span className="text-white">{product.title}</span>
            </div>
          }
          stats={[
            { label: "Seller", value: vendor?.store_name || "Tienda" },
            { label: "Compatibilidad", value: product.compatibility || "Rust" },
            { label: "Version actual", value: latestVersion?.version || "Sin version" },
            {
              label: "Valoracion",
              value: averageRating ? `${averageRating.toFixed(1)}/5` : "Sin valoraciones",
            },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            {product.featured_image_url ? (
              <Image
                src={product.featured_image_url}
                alt={product.title}
                width={1400}
                height={700}
                className="h-72 w-full rounded-3xl object-cover"
              />
            ) : null}

            {(isOwner || isAdmin) && product.rejection_reason ? (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-300">
                Motivo de rechazo actual: {product.rejection_reason}
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <CommerceSectionHeading
                dataId="product-description"
                eyebrow="Producto"
                title="Descripcion"
                description="Lee la propuesta de valor y el alcance funcional antes de decidir la compra."
              />
              <p className="mt-4 whitespace-pre-wrap text-[var(--text-soft)]">
                {product.description || "Este producto no tiene descripcion detallada todavia."}
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Version actual</h2>
              {latestVersion ? (
                <div className="mt-4 space-y-3">
                  <p className="text-lg font-semibold text-white">{latestVersion.version}</p>
                  <p className="text-sm text-[var(--text-soft)]">
                    Publicada el {new Date(latestVersion.created_at).toLocaleString("es-ES")}
                  </p>
                  <p className="whitespace-pre-wrap text-[var(--text-soft)]">
                    {latestVersion.changelog || "Sin changelog para esta version."}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-[var(--text-soft)]">Aun no hay versiones publicadas.</p>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Historial de versiones</h2>
              {versions && versions.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {versions.map((version) => (
                    <div key={version.id} className="rounded-2xl border border-white/10 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white">{version.version}</p>
                          {!downloadableVersionIds.has(version.id) ? (
                            <p className="mt-1 text-xs text-amber-300">
                              Version sin archivo descargable asociado
                            </p>
                          ) : null}
                        </div>
                        <p className="text-xs text-[var(--text-soft)]">
                          {new Date(version.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                        {version.changelog || "Sin changelog."}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[var(--text-soft)]">No hay historial de versiones todavia.</p>
              )}
            </div>

            {(product.support_policy || product.refund_policy || product.update_policy) ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">Soporte y politicas</h2>
                <div className="mt-4 space-y-5">
                  {product.support_policy ? (
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Soporte
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[var(--text-soft)]">
                        {product.support_policy}
                      </p>
                    </div>
                  ) : null}
                  {product.update_policy ? (
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Actualizaciones
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[var(--text-soft)]">
                        {product.update_policy}
                      </p>
                    </div>
                  ) : null}
                  {product.refund_policy ? (
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Reembolsos
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[var(--text-soft)]">
                        {product.refund_policy}
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/help"
                    className="inline-flex rounded-2xl border border-white/10 bg-black/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Abrir help center
                  </Link>
                  <Link
                    href="/policies/reembolsos-y-reclamaciones"
                    className="inline-flex rounded-2xl border border-white/10 bg-black/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Ver policy de reembolsos
                  </Link>
                </div>
              </div>
            ) : null}

            {productCommerceHelpContext ? (
              <ProductCommerceHelpPanel context={productCommerceHelpContext} />
            ) : null}

            {faqs && faqs.length > 0 ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">Preguntas frecuentes</h2>
                <div className="mt-4 space-y-4">
                  {faqs.map((faq) => (
                    <article key={faq.id} className="rounded-2xl border border-white/10 p-4">
                      <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                        {faq.answer}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {guides && guides.length > 0 ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">Guias y tutoriales</h2>
                <div className="mt-4 space-y-4">
                  {guides.map((guide) => (
                    <article key={guide.id} className="rounded-2xl border border-white/10 p-4">
                      <h3 className="text-base font-semibold text-white">{guide.title}</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                        {guide.body}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-[var(--text-soft)]">Precio</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {product.is_free
                  ? "Gratis"
                  : `EUR ${((activeDeal?.discountedPriceCents ?? product.price_cents) / 100).toFixed(2)}`}
              </p>
              {activeDeal ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-[var(--text-soft)] line-through">
                    EUR {(product.price_cents / 100).toFixed(2)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge>
                      {activeDeal.discountType === "percent"
                        ? `${activeDeal.discountValue}% OFF`
                        : `Ahorra EUR ${(activeDeal.savingsCents / 100).toFixed(2)}`}
                    </Badge>
                    <Badge>{activeDeal.promoLabel}</Badge>
                  </div>
                  <p className="text-sm text-emerald-300">
                    Ahorro inmediato de EUR {(activeDeal.savingsCents / 100).toFixed(2)}
                    {activeDeal.expiresAt
                      ? ` | Activo hasta ${new Date(activeDeal.expiresAt).toLocaleString("es-ES")}`
                      : ""}
                  </p>
                </div>
              ) : null}

              <div className="mt-6 space-y-4">
                <WishlistButton
                  productId={product.id}
                  initialWishlisted={isWishlisted}
                  initialCount={wishlistCount || 0}
                  pageType="product_detail"
                />
                {user ? (
                  <ProductCollectionButton
                    productId={product.id}
                    initialCollections={userCollections.map((collection) => ({
                      id: collection.id,
                      title: collection.title,
                      slug: collection.slug,
                      description: collection.description,
                      isPublic: collection.is_public,
                      itemCount: userCollectionItemCounts.get(collection.id) || 0,
                      isIncluded: includedCollectionIds.has(collection.id),
                    }))}
                  />
                ) : null}
                {!user ? (
                  <>
                    <p className="text-sm text-[var(--text-soft)]">
                      Necesitas iniciar sesion para descargar este producto.
                    </p>
                    <Link
                      href="/login"
                      className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Iniciar sesion
                    </Link>
                  </>
                ) : canDownload ? (
                  <>
                    <p className="text-sm text-[var(--text-soft)]">
                      La descarga se generara con un enlace temporal y seguro.
                    </p>
                    <DownloadButton productId={product.id} />
                  </>
                ) : hasRevokedLicense ? (
                  <>
                    <p className="text-sm text-amber-300">
                      Tu licencia para este producto esta revocada. La descarga esta bloqueada.
                    </p>
                    <Link
                      href="/licenses"
                      className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Ver licencias
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[var(--text-soft)]">
                      Este producto requiere una compra completada antes de poder descargarlo.
                    </p>
                    <Link
                      href={checkoutHref}
                      className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Ir al checkout
                    </Link>
                    {activeDeal ? (
                      <p className="text-sm text-[var(--text-soft)]">
                        {activeDeal.source === "coupon" && activeDeal.code
                          ? (
                              <>
                                El checkout puede aplicar automaticamente el codigo{" "}
                                <span className="font-semibold text-white">{activeDeal.code}</span>.
                              </>
                            )
                          : "El checkout aplicara automaticamente la promocion activa."}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">Detalles</h2>
                <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>
                  Juego: <span className="text-white">{game?.name || "Rust"}</span>
                </p>
                <p>
                  Categoria: <span className="text-white">{category?.name || "Marketplace"}</span>
                </p>
                <p>
                  Compatibilidad: <span className="text-white">{product.compatibility || "Rust"}</span>
                </p>
                <p>
                  Creador:{" "}
                  {vendor?.slug ? (
                    <Link href={`/seller/${vendor.slug}`} className="text-white hover:underline">
                      {vendor.store_name}
                    </Link>
                  ) : (
                    <span className="text-white">{vendor?.store_name || "Tienda"}</span>
                  )}
                </p>
                <p>
                  Publicado:{" "}
                  <span className="text-white">
                    {new Date(product.created_at).toLocaleDateString("es-ES")}
                  </span>
                </p>
                <p>
                  Version actual:{" "}
                  <span className="text-white">{latestVersion?.version || "Sin version"}</span>
                </p>
                <p>
                  Valoracion media:{" "}
                  <span className="text-white">
                    {averageRating ? `${averageRating.toFixed(1)}/5` : "Sin valoraciones"}
                  </span>
                </p>
                {activeDeal ? (
                  <p>
                    Deal activo:{" "}
                    <span className="text-white">
                      {activeDeal.promoLabel}
                    </span>
                  </p>
                  ) : null}
                </div>
              </div>

              {shoppingQualitySnapshot ? (
                <ShoppingQualitySummary snapshot={shoppingQualitySnapshot} variant="detail" />
              ) : null}

              {sellerProfile ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Sobre el creador</h2>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                      Contexto y senales de confianza del seller.
                    </p>
                  </div>
                  <Link
                    href={`/seller/${sellerProfile.vendor.slug}`}
                    className="text-sm font-semibold text-white hover:underline"
                  >
                    Ver perfil
                  </Link>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {sellerProfile.badges.map((badge) => (
                    <Badge key={badge.label}>{badge.label}</Badge>
                  ))}
                </div>

                {sellerProfile.identityVerification.isVerified ? (
                  <p className="mt-4 text-sm text-[var(--text-soft)]">
                    Identidad verificada en{" "}
                    <span className="text-white">
                      {sellerProfile.identityVerification.providers
                        .map((provider) => provider.charAt(0).toUpperCase() + provider.slice(1))
                        .join(" y ")}
                    </span>
                    .
                  </p>
                ) : null}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-sm text-[var(--text-soft)]">Catalogo aprobado</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {sellerProfile.metrics.approvedProducts}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-sm text-[var(--text-soft)]">Valoracion agregada</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {sellerProfile.metrics.averageRating
                        ? `${sellerProfile.metrics.averageRating}/5`
                        : "--"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-sm text-[var(--text-soft)]">Compras</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {sellerProfile.metrics.totalPurchases}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-sm text-[var(--text-soft)]">Descargas</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {sellerProfile.metrics.totalDownloads}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4 sm:col-span-2">
                    <p className="text-sm text-[var(--text-soft)]">Trust score</p>
                    <div className="mt-3 flex items-center gap-4">
                      <p className="text-2xl font-bold text-white">
                        {sellerProfile.metrics.reputationScore}
                      </p>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[var(--primary)]"
                          style={{
                            width: `${Math.min(100, sellerProfile.metrics.reputationScore)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-[var(--text-soft)]">
                  {sellerProfile.vendor.bio || "Este seller mantiene un catalogo publico en ForjaDev."}
                </p>
              </div>
            ) : vendor?.bio ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">Sobre el creador</h2>
                <p className="mt-4 text-[var(--text-soft)]">{vendor.bio}</p>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Valoraciones</h2>
              <div className="mt-4 flex items-end gap-4">
                <p className="text-4xl font-bold text-white">
                  {averageRating ? averageRating.toFixed(1) : "--"}
                </p>
                <div className="pb-1 text-sm text-[var(--text-soft)]">
                  <p>{reviews?.length || 0} resenas publicadas</p>
                  <p>
                    {reviews && reviews.length > 0
                      ? "Feedback de compradores reales"
                      : "Aun no hay opiniones para este producto"}
                  </p>
                </div>
              </div>
            </div>

            {canReview && !existingReview ? <ReviewForm productId={product.id} /> : null}

            {existingReview ? (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                <h2 className="text-xl font-semibold text-white">Tu valoracion</h2>
                <p className="mt-3 text-sm text-emerald-300">
                  Ya has enviado una valoracion para este producto.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Opiniones de compradores</h2>
            {reviews && reviews.length > 0 ? (
              <div className="mt-5 space-y-4">
                {reviews.map((review) => (
                  <article key={review.id} className="rounded-2xl border border-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {review.title || "Comprador verificado"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-soft)]">
                          {new Date(review.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                      <p className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-white">
                        {review.rating}/5
                      </p>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                      {review.body || "Sin comentario adicional."}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-[var(--text-soft)]">
                Aun no hay valoraciones para este producto.
              </p>
            )}
          </div>
        </div>

        <section className="mt-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Discusiones del producto</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Conversaciones publicas para dudas, contexto de uso y feedback util para la comunidad.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              {user ? (
                <DiscussionThreadForm productId={product.id} />
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <p className="text-[var(--text-soft)]">
                    Inicia sesion para abrir una discusion sobre este producto.
                  </p>
                  <Link
                    href="/login"
                    className="mt-4 inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    Iniciar sesion
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold text-white">Hilos recientes</h3>
              {discussionRows.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {discussionRows.map((discussion) => {
                    const author = discussionProfileById.get(discussion.author_user_id);
                    const threadMessages = discussionMessagesById.get(discussion.id) || [];
                    const trustSnapshot = buildDiscussionTrustSnapshot({
                      discussion,
                      messages: threadMessages,
                      sellerUserId: vendor?.user_id || null,
                    });

                    return (
                      <article key={discussion.id} className="rounded-2xl border border-white/10 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              {discussion.is_pinned ? <Badge>Fijada</Badge> : null}
                              {discussion.is_locked ? <Badge>Bloqueada</Badge> : null}
                              {trustSnapshot.hasSellerResponse ? (
                                <Badge>Respondida por seller</Badge>
                              ) : (
                                <Badge>Pendiente del seller</Badge>
                              )}
                            </div>
                            <h4 className="mt-3 text-lg font-semibold text-white">
                              {discussion.title}
                            </h4>
                            <p className="mt-2 line-clamp-3 text-sm text-[var(--text-soft)]">
                              {discussion.body}
                            </p>
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                                Estado del hilo
                              </p>
                              <p className="mt-2 text-sm font-semibold text-white">
                                {trustSnapshot.statusLabel}
                              </p>
                              <p className="mt-2 text-sm text-[var(--text-soft)]">
                                {trustSnapshot.nextAction}
                              </p>
                              {trustSnapshot.latestSellerReplyPreview ? (
                                <p className="mt-3 text-sm text-[var(--text-soft)]">
                                  Ultima respuesta del creador:{" "}
                                  <span className="text-white">
                                    {trustSnapshot.latestSellerReplyPreview}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Link
                            href={`/products/${product.slug}/discussions/${discussion.id}`}
                            className="text-sm font-semibold text-white hover:underline"
                          >
                            Abrir
                          </Link>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--text-soft)]">
                          <span>
                            Por{" "}
                            {author?.display_name ||
                              author?.username ||
                              author?.email ||
                              "Usuario"}
                          </span>
                          <span>{trustSnapshot.totalReplies} respuestas</span>
                          <span>{trustSnapshot.sellerReplyCount} del creador</span>
                          <span>
                            Actualizada {new Date(trustSnapshot.latestReplyAt).toLocaleString("es-ES")}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
                  <p className="text-[var(--text-soft)]">
                    Todavia no hay discusiones. La primera conversacion util puede empezar aqui.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <ProductCompositionPanel
          productTitle={product.title}
          basePriceCents={product.price_cents}
          bundles={productCompositionBundles}
        />

        {alsoBoughtProducts.length > 0 ? (
          <section className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Los usuarios tambien compraron</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Recomendaciones basadas en patrones reales de compra alrededor de este producto.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {alsoBoughtProducts.map((item) => {
                const deal = loopDealsByProductId.get(item.id);

                return (
                  <ProductCard
                    key={item.id}
                    title={item.title}
                    author={vendorById.get(item.vendor_id) || "ForjaDev"}
                    category={categoryById.get(item.category_id || "") || "Marketplace"}
                    price={
                      item.is_free
                        ? "Gratis"
                        : `EUR ${((deal?.discountedPriceCents ?? item.price_cents) / 100).toFixed(2)}`
                    }
                    originalPrice={
                      deal && deal.discountedPriceCents < item.price_cents
                        ? `EUR ${(item.price_cents / 100).toFixed(2)}`
                        : null
                    }
                    promoLabel={deal?.promoLabel || null}
                    compatibility={item.compatibility || game?.name || "Rust"}
                    ratingAverage={item.rating_average}
                    ratingCount={item.rating_count}
                    href={`/products/${item.slug}`}
                    imageUrl={item.featured_image_url}
                    tracking={{
                      pageType: "product_detail",
                      entityId: item.id,
                      metadata: {
                        source: "users_also_bought",
                        productId: product.id,
                        hasDeal: Boolean(deal),
                      },
                    }}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {similarProducts.length > 0 ? (
          <section className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Productos similares</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Ranking por cercania de categoria, juego y senales de calidad/trust.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {similarProducts.map((item) => {
                const deal = loopDealsByProductId.get(item.id);

                return (
                  <ProductCard
                    key={item.id}
                    title={item.title}
                    author={vendorById.get(item.vendor_id) || "ForjaDev"}
                    category={categoryById.get(item.category_id || "") || "Marketplace"}
                    price={
                      item.is_free
                        ? "Gratis"
                        : `EUR ${((deal?.discountedPriceCents ?? item.price_cents) / 100).toFixed(2)}`
                    }
                    originalPrice={
                      deal && deal.discountedPriceCents < item.price_cents
                        ? `EUR ${(item.price_cents / 100).toFixed(2)}`
                        : null
                    }
                    promoLabel={
                      deal?.promoLabel || null
                    }
                    compatibility={item.compatibility || game?.name || "Rust"}
                    ratingAverage={item.rating_average}
                    ratingCount={item.rating_count}
                    href={`/products/${item.slug}`}
                    imageUrl={item.featured_image_url}
                    tracking={{
                      pageType: "product_detail",
                      entityId: item.id,
                      metadata: {
                        source: "similar_products",
                        productId: product.id,
                        hasDeal: Boolean(deal),
                      },
                    }}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {sellerProducts.length > 0 ? (
          <section className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Mas de {vendor?.store_name || "este creador"}</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Sigue explorando otros productos publicados por el mismo seller.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {sellerProducts.map((item) => {
                const deal = loopDealsByProductId.get(item.id);

                return (
                  <ProductCard
                    key={item.id}
                    title={item.title}
                    author={vendorById.get(item.vendor_id) || "ForjaDev"}
                    category={categoryById.get(item.category_id || "") || "Marketplace"}
                    price={
                      item.is_free
                        ? "Gratis"
                        : `EUR ${((deal?.discountedPriceCents ?? item.price_cents) / 100).toFixed(2)}`
                    }
                    originalPrice={
                      deal && deal.discountedPriceCents < item.price_cents
                        ? `EUR ${(item.price_cents / 100).toFixed(2)}`
                        : null
                    }
                    promoLabel={
                      deal?.promoLabel || null
                    }
                    compatibility={item.compatibility || game?.name || "Rust"}
                    ratingAverage={item.rating_average}
                    ratingCount={item.rating_count}
                    href={`/products/${item.slug}`}
                    imageUrl={item.featured_image_url}
                    tracking={{
                      pageType: "product_detail",
                      entityId: item.id,
                      metadata: {
                        source: "seller_products",
                        productId: product.id,
                        hasDeal: Boolean(deal),
                      },
                    }}
                  />
                );
              })}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
