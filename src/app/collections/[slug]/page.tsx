import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

interface CollectionItemRow {
  sort_order: number;
  created_at: string;
  product: {
    id: string;
    vendor_id: string;
    category_id: string | null;
    game_id: string | null;
    title: string;
    slug: string;
    price_cents: number;
    is_free: boolean;
    compatibility: string | null;
    featured_image_url: string | null;
    rating_average: number;
    rating_count: number;
  }[] | {
    id: string;
    vendor_id: string;
    category_id: string | null;
    game_id: string | null;
    title: string;
    slug: string;
    price_cents: number;
    is_free: boolean;
    compatibility: string | null;
    featured_image_url: string | null;
    rating_average: number;
    rating_count: number;
  } | null;
}

export default async function CollectionDetailPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const adminSupabase = createOptionalAdminClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("id, user_id, title, slug, description, is_public, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) {
    notFound();
  }

  const [{ data: collectionItemsData }, { data: ownerData }] = await Promise.all([
    supabase
      .from("collection_items")
      .select(
        "sort_order, created_at, product:products(id, vendor_id, category_id, game_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count)"
      )
      .eq("collection_id", collection.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    adminSupabase
      ? adminSupabase
          .from("profiles")
          .select("id, username, display_name, email")
          .eq("id", collection.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const items = ((collectionItemsData || []) as CollectionItemRow[])
    .map((item) => ({
      ...item,
      product: Array.isArray(item.product) ? item.product[0] || null : item.product,
    }))
    .filter(
      (
        item
      ): item is CollectionItemRow & {
        product: NonNullable<CollectionItemRow["product"]> extends infer P
          ? P extends any[]
            ? never
            : NonNullable<P>
          : never;
      } => Boolean(item.product)
    );

  const vendorIds = Array.from(new Set(items.map((item) => item.product.vendor_id)));
  const categoryIds = Array.from(
    new Set(items.map((item) => item.product.category_id).filter(Boolean))
  );
  const gameIds = Array.from(
    new Set(items.map((item) => item.product.game_id).filter(Boolean))
  );

  const [vendorsResult, categoriesResult, gamesResult] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; store_name: string }> }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    gameIds.length > 0
      ? supabase.from("games").select("id, name").in("id", gameIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const vendorById = new Map(
    (vendorsResult.data || []).map((item) => [item.id, item.store_name])
  );
  const categoryById = new Map(
    (categoriesResult.data || []).map((item) => [item.id, item.name])
  );
  const gameById = new Map((gamesResult.data || []).map((item) => [item.id, item.name]));
  const owner = ownerData as ProfileRow | null;

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="collection.visited"
        pageType="collection_detail"
        entityType="collection"
        entityId={collection.id}
        metadata={{
          slug: collection.slug,
          itemCount: items.length,
          isPublic: collection.is_public,
        }}
      />
      <section className="container-shell py-16">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
          <Link href="/collections" className="hover:text-white">
            Colecciones
          </Link>
          <span>/</span>
          <span className="text-white">{collection.title}</span>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              User collection
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">{collection.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-[var(--text-soft)]">
              {collection.description || "Coleccion comunitaria para descubrir recursos relacionados."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Badge>{collection.is_public ? "Publica" : "Privada"}</Badge>
              <Badge>{items.length} productos</Badge>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Contexto
            </p>

            <div className="mt-5 space-y-3 text-sm text-[var(--text-soft)]">
              <p>
                Curada por{" "}
                <span className="text-white">
                  {owner?.display_name || owner?.username || owner?.email || "Usuario ForjaDev"}
                </span>
              </p>
              <p>
                Creada el{" "}
                <span className="text-white">
                  {new Date(collection.created_at).toLocaleDateString("es-ES")}
                </span>
              </p>
              <p>
                Ultima actualizacion{" "}
                <span className="text-white">
                  {new Date(collection.updated_at).toLocaleDateString("es-ES")}
                </span>
              </p>
            </div>

            <div className="mt-6">
              <Link href="/collections">
                <Button variant="secondary">Ver mas colecciones</Button>
              </Link>
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <section className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Productos incluidos</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Seleccionados para formar una curacion coherente alrededor de una necesidad real.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <ProductCard
                  key={item.product.id}
                  title={item.product.title}
                  author={vendorById.get(item.product.vendor_id) || "ForjaDev"}
                  category={categoryById.get(item.product.category_id || "") || "Marketplace"}
                  price={
                    item.product.is_free
                      ? "Gratis"
                      : `EUR ${(item.product.price_cents / 100).toFixed(2)}`
                  }
                  compatibility={
                    item.product.compatibility || gameById.get(item.product.game_id || "") || "Rust"
                  }
                  ratingAverage={item.product.rating_average}
                  ratingCount={item.product.rating_count}
                  href={`/products/${item.product.slug}`}
                  imageUrl={item.product.featured_image_url}
                  tracking={{
                    pageType: "collection_detail",
                    entityId: item.product.id,
                    metadata: {
                      source: "collection",
                      collectionId: collection.id,
                    },
                  }}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center">
            <p className="text-[var(--text-soft)]">
              Esta coleccion todavia no tiene productos visibles.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
