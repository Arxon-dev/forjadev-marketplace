import Link from "next/link";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface CollectionRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface CollectionItemRow {
  collection_id: string;
  product: {
    id: string;
    title: string;
    slug: string;
  }[] | {
    id: string;
    title: string;
    slug: string;
  } | null;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

export default async function CollectionsPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: collectionsData } = await supabase
    .from("collections")
    .select("id, user_id, title, slug, description, is_public, created_at, updated_at")
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(24);

  const collections = (collectionsData || []) as CollectionRow[];
  const collectionIds = collections.map((collection) => collection.id);
  const profileIds = Array.from(new Set(collections.map((collection) => collection.user_id)));

  const [{ data: collectionItemsData }, { data: profileData }] = await Promise.all([
    collectionIds.length > 0
      ? supabase
          .from("collection_items")
          .select("collection_id, product:products(id, title, slug)")
          .in("collection_id", collectionIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as CollectionItemRow[] }),
    profileIds.length > 0
      ? adminSupabase
          .from("profiles")
          .select("id, username, display_name, email")
          .in("id", profileIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
  ]);

  const profileById = new Map(
    ((profileData || []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );
  const itemsByCollectionId = new Map<
    string,
    Array<{ id: string; title: string; slug: string }>
  >();

  ((collectionItemsData || []) as CollectionItemRow[]).forEach((item) => {
    const product = Array.isArray(item.product) ? item.product[0] || null : item.product;

    if (!product) {
      return;
    }

    const current = itemsByCollectionId.get(item.collection_id) || [];
    current.push(product);
    itemsByCollectionId.set(item.collection_id, current);
  });

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker eventName="collections.index.visited" pageType="collections_index" />
      <section className="container-shell py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Community layer
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">Colecciones publicas</h1>
            <p className="mt-4 max-w-3xl text-lg text-[var(--text-soft)]">
              Curaciones creadas por usuarios para recomendar stacks, setups y combinaciones que
              merecen ser descubiertas.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products">
              <Button variant="secondary">Explorar productos</Button>
            </Link>
            {user ? (
              <Link href="/dashboard">
                <Button>Crear tu coleccion</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button>Iniciar sesion</Button>
              </Link>
            )}
          </div>
        </div>

        {collections.length > 0 ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection) => {
              const items = itemsByCollectionId.get(collection.id) || [];
              const owner = profileById.get(collection.user_id);

              return (
                <article
                  key={collection.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Coleccion publica
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold text-white">
                        {collection.title}
                      </h2>
                    </div>
                    <Link
                      href={`/collections/${collection.slug}`}
                      className="text-sm font-semibold text-white hover:underline"
                    >
                      Abrir
                    </Link>
                  </div>

                  <p className="mt-4 text-sm text-[var(--text-soft)]">
                    {collection.description || "Coleccion curada por la comunidad de ForjaDev."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {items.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        href={`/products/${item.slug}`}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--text-soft)] transition hover:border-white/20 hover:text-white"
                      >
                        {item.title}
                      </Link>
                    ))}
                    {items.length > 3 ? (
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--text-soft)]">
                        +{items.length - 3} mas
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-4 text-xs text-[var(--text-soft)]">
                    <span>
                      Por{" "}
                      {owner?.display_name || owner?.username || owner?.email || "Usuario ForjaDev"}
                    </span>
                    <span>{items.length} productos</span>
                    <span>
                      Actualizada {new Date(collection.updated_at).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center">
            <p className="text-[var(--text-soft)]">
              Todavia no hay colecciones publicas. La primera curacion fuerte puede abrir una nueva
              forma de descubrir el catalogo.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
