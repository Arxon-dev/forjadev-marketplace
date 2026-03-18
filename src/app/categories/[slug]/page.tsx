import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, description, parent_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) {
    notFound();
  }

  const [{ data: childCategories }, { data: allCategories }] = await Promise.all([
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
            "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count"
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
      ? supabase.from("vendors").select("id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; store_name: string }> }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const vendorById = new Map(
    (vendorsResult.data || []).map((vendor) => [vendor.id, vendor.store_name])
  );
  const categoryById = new Map(
    (categoriesResult.data || []).map((item) => [item.id, item.name])
  );
  const parentCategory =
    category.parent_id !== null
      ? (allCategories || []).find((item) => item.id === category.parent_id) || null
      : null;

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
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
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

          <div className="mt-6 max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--primary)]">
              Categoria
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">{category.name}</h1>
            <p className="mt-4 text-base text-[var(--text-soft)] md:text-lg">
              {category.description ||
                "Descubre productos curados dentro de esta categoria del marketplace."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Badge>{products?.length || 0} productos</Badge>
              {childCategories && childCategories.length > 0 ? (
                <Badge>{childCategories.length} subcategorias</Badge>
              ) : null}
            </div>
          </div>
        </div>

        {childCategories && childCategories.length > 0 ? (
          <section className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Subcategorias</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Refina tu navegacion desde las areas mas especificas de esta categoria.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {childCategories.map((item) => (
                <Link
                  key={item.id}
                  href={`/categories/${item.slug}`}
                  className="block transition-transform hover:-translate-y-1"
                >
                  <Card className="h-full p-5 hover:bg-white/[0.07]">
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Productos en {category.name}</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Seleccion preparados para discovery rapido dentro de esta vertical.
            </p>
          </div>

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
