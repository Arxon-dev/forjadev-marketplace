import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface GamePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!game) {
    notFound();
  }

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count"
    )
    .eq("moderation_status", "approved")
    .eq("game_id", game.id)
    .order("featured", { ascending: false })
    .order("purchase_count", { ascending: false })
    .order("download_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(12);

  const vendorIds = Array.from(new Set((products || []).map((product) => product.vendor_id)));
  const categoryIds = Array.from(
    new Set((products || []).map((product) => product.category_id).filter(Boolean))
  );

  const [vendorsResult, categoriesResult] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; store_name: string }> }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name, slug").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string }> }),
  ]);

  const vendorById = new Map(
    (vendorsResult.data || []).map((vendor) => [vendor.id, vendor.store_name])
  );
  const categoryById = new Map(
    (categoriesResult.data || []).map((category) => [category.id, category.name])
  );

  const categoryCounts = new Map<string, { name: string; slug: string; count: number }>();
  (products || []).forEach((product) => {
    const matchingCategory = (categoriesResult.data || []).find(
      (item) => item.id === product.category_id
    );

    if (!matchingCategory) {
      return;
    }

    const existing = categoryCounts.get(matchingCategory.id);
    if (existing) {
      existing.count += 1;
      return;
    }

    categoryCounts.set(matchingCategory.id, {
      name: matchingCategory.name,
      slug: matchingCategory.slug,
      count: 1,
    });
  });

  const topCategories = Array.from(categoryCounts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 4);

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="game.visited"
        pageType="game"
        entityType="game"
        entityId={game.id}
        metadata={{
          slug: game.slug,
          productCount: products?.length || 0,
        }}
      />
      <section className="container-shell py-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
            <Link href="/products" className="hover:text-white">
              Productos
            </Link>
            <span>/</span>
            <span className="text-white">{game.name}</span>
          </div>

          <div className="mt-6 max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--primary)]">
              Juego
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">{game.name}</h1>
            <p className="mt-4 text-base text-[var(--text-soft)] md:text-lg">
              Descubre plugins, mapas y herramientas curadas especificamente para {game.name}.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Badge>{products?.length || 0} productos visibles</Badge>
              <Badge>Marketplace activo</Badge>
            </div>
          </div>
        </div>

        {topCategories.length > 0 ? (
          <section className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Top categorias en {game.name}</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Explora las verticales con mas densidad de oferta dentro de este juego.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {topCategories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/products?game=${game.slug}&category=${category.slug}`}
                  className="block transition-transform hover:-translate-y-1"
                >
                  <Card className="h-full p-5 hover:bg-white/[0.07]">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                      <Badge>{category.count}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
                      Entra en esta categoria dentro de {game.name} y reduce friccion en discovery.
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Productos destacados de {game.name}</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Seleccion de recursos listos para descubrir, comparar y desplegar.
            </p>
          </div>

          {products && products.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  title={product.title}
                  author={vendorById.get(product.vendor_id) || "ForjaDev"}
                  category={categoryById.get(product.category_id || "") || "Marketplace"}
                  price={product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`}
                  compatibility={product.compatibility || game.name}
                  ratingAverage={product.rating_average}
                  ratingCount={product.rating_count}
                  href={`/products/${product.slug}`}
                  imageUrl={product.featured_image_url}
                  tracking={{
                    pageType: "game",
                    entityId: product.id,
                    metadata: {
                      source: game.slug,
                    },
                  }}
                />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-[var(--text-soft)]">
                Aun no hay productos visibles para este juego.
              </p>
            </Card>
          )}
        </section>
      </section>
    </main>
  );
}
