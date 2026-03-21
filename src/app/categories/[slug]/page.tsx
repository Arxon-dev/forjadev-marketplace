import type { Metadata } from "next";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { DiscoveryNavSpine } from "@/components/discovery/discovery-nav-spine";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import {
  CommerceSectionHeading,
  CommerceStage,
  commercePanelClassName,
} from "@/components/marketplace/commerce-surface-system";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildShoppingQualitySnapshot } from "@/lib/marketplace/quality-signals";
import { buildPublicMetadata } from "@/lib/seo/public-metadata";
import { createClient } from "@/lib/supabase/server";

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("name, slug, description, parent_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) {
    return buildPublicMetadata({
      title: "Categoria no disponible",
      description: "La categoria solicitada no esta disponible o ya no forma parte del catalogo publico.",
      path: `/categories/${slug}`,
      index: false,
    });
  }

  return buildPublicMetadata({
    title: `${category.name} en el marketplace`,
    description:
      category.description ||
      `Explora productos de ${category.name} dentro de ForjaDev y compara recursos con la misma intencion comercial.`,
    path: `/categories/${category.slug}`,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, description, parent_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) {
    notFound();
  }

  const [{ data: childCategories }, { data: allCategories }, { data: games }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description")
      .eq("parent_id", category.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, slug, parent_id")
      .eq("is_active", true),
    supabase
      .from("games")
      .select("id, name, slug, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const relatedCategoryIds = [
    category.id,
    ...(category.parent_id === null ? (childCategories || []).map((item) => item.id) : []),
  ];

  const { data: mappings } = await supabase
    .from("product_categories")
    .select("product_id")
    .in("category_id", relatedCategoryIds);

  const productIds = Array.from(new Set((mappings || []).map((item) => item.product_id)));

  const { data: products } =
    productIds.length > 0
        ? await supabase
          .from("products")
          .select(
            "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, updated_at, support_policy, refund_policy, update_policy"
          )
          .eq("moderation_status", "approved")
          .in("id", productIds)
          .order("featured", { ascending: false })
          .order("purchase_count", { ascending: false })
          .order("updated_at", { ascending: false })
      : { data: [] };

  const vendorIds = Array.from(new Set((products || []).map((product) => product.vendor_id)));
  const categoryIds = Array.from(
    new Set((products || []).map((product) => product.category_id).filter(Boolean))
  );

  const [vendorsResult, categoriesResult] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, user_id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; store_name: string }> }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  const vendorRows = vendorsResult.data || [];
  const vendorUserIds = Array.from(new Set(vendorRows.map((vendor) => vendor.user_id).filter(Boolean)));
  const [sellerSnapshotsResult, identitiesResult] = await Promise.all([
    vendorIds.length > 0
      ? adminSupabase
          .from("seller_reputation_snapshots")
          .select("vendor_id, approved_products, total_purchases, latest_product_update_at")
          .in("vendor_id", vendorIds)
      : Promise.resolve({
          data: [] as Array<{
            vendor_id: string;
            approved_products: number;
            total_purchases: number;
            latest_product_update_at: string | null;
          }>,
        }),
    vendorUserIds.length > 0
      ? adminSupabase.from("user_provider_identities").select("user_id").in("user_id", vendorUserIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string }> }),
  ]);

  const vendorById = new Map(
    vendorRows.map((vendor) => [vendor.id, vendor.store_name])
  );
  const vendorUserIdByVendorId = new Map(vendorRows.map((vendor) => [vendor.id, vendor.user_id]));
  const snapshotByVendorId = new Map(
    (sellerSnapshotsResult.data || []).map((snapshot) => [snapshot.vendor_id, snapshot])
  );
  const verifiedUserIds = new Set((identitiesResult.data || []).map((identity) => identity.user_id));
  const categoryById = new Map(
    (categoriesResult.data || []).map((item) => [item.id, item.name])
  );
  const parentCategory =
    category.parent_id !== null
      ? (allCategories || []).find((item) => item.id === category.parent_id) || null
      : null;
  const siblingCategories =
    parentCategory !== null
      ? (allCategories || [])
          .filter((item) => item.parent_id === parentCategory.id)
          .slice(0, 6)
      : (allCategories || []).filter((item) => item.parent_id === null).slice(0, 6);
  const primaryLinks = [
    { label: "Catalogo completo", href: "/products" },
    { label: "Categorias", href: "/categories" },
    { label: "Juegos", href: "/games" },
  ];
  const categoryLinks = siblingCategories.map((item) => ({
    label: item.name,
    href: `/categories/${item.slug}`,
    active: item.slug === category.slug,
  }));
  const gameLinks = (games || []).slice(0, 6).map((item) => ({
    label: item.name,
    href: `/games/${item.slug}`,
  }));

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="category.visited"
        pageType="category"
        entityType="category"
        entityId={category.id}
        metadata={{
          slug: category.slug,
          productCount: products?.length || 0,
        }}
      />
      <section className="container-shell py-16">
        <DiscoveryNavSpine
          eyebrow="Marketplace Browse"
          title={`Explora ${category.name} dentro del marketplace`}
          description="Mantente dentro de una ruta comercial estable: vuelve al catalogo general, cambia de categoria o entra por juego sin perder el contexto de browsing."
          path={[
            { label: "Productos", href: "/products" },
            { label: "Categorias", href: "/categories" },
            ...(parentCategory
              ? [{ label: parentCategory.name, href: `/categories/${parentCategory.slug}` }]
              : []),
            { label: category.name, href: `/categories/${category.slug}`, active: true },
          ]}
          primaryLinks={primaryLinks}
          categoryLinks={categoryLinks}
          gameLinks={gameLinks}
        />

        <div className="mt-10">
          <CommerceStage
            dataId="category-stage"
            eyebrow="Categoria"
            title={category.name}
            description={
              category.description ||
              "Descubre productos curados dentro de esta categoria del marketplace."
            }
            surface="context"
            path={
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
                <Link href="/products" className="hover:text-white">
                  Productos
                </Link>
                {parentCategory ? (
                  <>
                    <span>/</span>
                    <Link href={`/categories/${parentCategory.slug}`} className="hover:text-white">
                      {parentCategory.name}
                    </Link>
                  </>
                ) : null}
                <span>/</span>
                <span className="text-white">{category.name}</span>
              </div>
            }
            stats={[
              { label: "Productos", value: String(products?.length || 0) },
              {
                label: "Subcategorias",
                value: String(childCategories && childCategories.length > 0 ? childCategories.length : 0),
              },
            ]}
          />
        </div>

        {childCategories && childCategories.length > 0 ? (
          <section className="mt-12">
            <CommerceSectionHeading
              dataId="category-children"
              eyebrow="Refinamiento comercial"
              title="Subcategorias"
              description="Refina tu navegacion desde las areas mas especificas de esta categoria."
            />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {childCategories.map((item) => (
                <Link
                  key={item.id}
                  href={`/categories/${item.slug}`}
                  className="block transition-transform hover:-translate-y-1"
                >
                  <Card className={`${commercePanelClassName("tile")} h-full p-5 hover:bg-white/[0.08]`}>
                    <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                      {item.description ||
                        "Accede a una vista mas afinada para este tipo de recursos."}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12">
            <CommerceSectionHeading
              dataId="category-products"
              eyebrow="Shopping journey"
              title={`Productos en ${category.name}`}
              description="Seleccion preparados para discovery rapido dentro de esta vertical."
            />

          {products && products.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  title={product.title}
                  author={vendorById.get(product.vendor_id) || "ForjaDev"}
                  category={categoryById.get(product.category_id || "") || category.name}
                  price={product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`}
                  compatibility={product.compatibility || "Rust"}
                  ratingAverage={product.rating_average}
                  ratingCount={product.rating_count}
                  qualitySnapshot={buildShoppingQualitySnapshot({
                    ratingAverage: product.rating_average,
                    ratingCount: product.rating_count,
                    supportPolicy: product.support_policy,
                    refundPolicy: product.refund_policy,
                    updatePolicy: product.update_policy,
                    lastUpdatedAt:
                      snapshotByVendorId.get(product.vendor_id)?.latest_product_update_at ||
                      product.updated_at,
                    sellerApprovedProducts:
                      snapshotByVendorId.get(product.vendor_id)?.approved_products || 0,
                    sellerTotalPurchases:
                      snapshotByVendorId.get(product.vendor_id)?.total_purchases || 0,
                    sellerIdentityVerified: verifiedUserIds.has(
                      vendorUserIdByVendorId.get(product.vendor_id) || ""
                    ),
                  })}
                  href={`/products/${product.slug}`}
                  imageUrl={product.featured_image_url}
                  tracking={{
                    pageType: "category",
                    entityId: product.id,
                    metadata: {
                      source: category.slug,
                    },
                  }}
                />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-[var(--text-soft)]">
                Aun no hay productos publicados en esta categoria.
              </p>
            </Card>
          )}
        </section>
      </section>
    </main>
  );
}
