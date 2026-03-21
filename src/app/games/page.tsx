import type { Metadata } from "next";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { DiscoveryNavSpine } from "@/components/discovery/discovery-nav-spine";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/public-metadata";
import { createClient } from "@/lib/supabase/server";

interface GameRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number | null;
}

interface ProductGameRow {
  id: string;
  game_id: string | null;
}

export const metadata: Metadata = buildPublicMetadata({
  title: "Juegos compatibles del marketplace",
  description:
    "Explora la oferta de ForjaDev por juego para entrar al catalogo desde el ecosistema correcto antes de bajar a categorias y productos.",
  path: "/games",
});

export default async function GamesIndexPage() {
  const supabase = await createClient();
  const [{ data: games }, { data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("games")
      .select("id, name, slug, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("products").select("id, game_id").eq("moderation_status", "approved"),
    supabase
      .from("categories")
      .select("id, name, slug, parent_id, sort_order")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(6),
  ]);

  const gameRows = (games || []) as GameRow[];
  const productRows = (products || []) as ProductGameRow[];
  const productCountByGameId = new Map<string, number>();
  productRows.forEach((product) => {
    if (!product.game_id) return;
    productCountByGameId.set(product.game_id, (productCountByGameId.get(product.game_id) || 0) + 1);
  });

  const primaryLinks = [
    { label: "Catalogo completo", href: "/products" },
    { label: "Juegos", href: "/games", active: true },
    { label: "Explorar categorias", href: "/categories" },
  ];

  const categoryLinks = (categories || []).slice(0, 6).map((category) => ({
    label: category.name,
    href: `/categories/${category.slug}`,
  }));

  const gameLinks = gameRows.slice(0, 6).map((game) => ({
    label: game.name,
    href: `/games/${game.slug}`,
  }));

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker eventName="games.index.visited" pageType="games_index" />
      <section className="container-shell py-16">
        <DiscoveryNavSpine
          eyebrow="Marketplace Browse"
          title="Explora el marketplace por juego"
          description="Esta vista te deja entrar al catalogo desde la plataforma correcta antes de bajar a categorias y productos concretos."
          path={[
            { label: "Productos", href: "/products" },
            { label: "Juegos", href: "/games", active: true },
          ]}
          primaryLinks={primaryLinks}
          categoryLinks={categoryLinks}
          gameLinks={gameLinks}
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {gameRows.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.slug}`}
              className="block transition-transform hover:-translate-y-1"
            >
              <Card className="h-full p-6 hover:bg-white/[0.07]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-white">{game.name}</h2>
                  <Badge>{productCountByGameId.get(game.id) || 0} productos</Badge>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
                  Entra a {game.name} para ver la oferta real de ese ecosistema y luego refinar por categoria si hace falta.
                </p>
                <p className="mt-5 text-sm font-semibold text-white">Abrir juego</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
