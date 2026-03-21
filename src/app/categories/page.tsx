import type { Metadata } from "next";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { DiscoveryNavSpine } from "@/components/discovery/discovery-nav-spine";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/public-metadata";
import { createClient } from "@/lib/supabase/server";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number | null;
}

export const metadata: Metadata = buildPublicMetadata({
  title: "Categorias del marketplace",
  description:
    "Explora las categorias principales de ForjaDev para comparar productos con la misma intencion de compra y uso.",
  path: "/categories",
});

export default async function CategoriesIndexPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: games }, { data: mappings }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, parent_id, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("games")
      .select("id, name, slug, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(6),
    supabase.from("product_categories").select("product_id, category_id"),
  ]);

  const categoryRows = (categories || []) as CategoryRow[];
  const rootCategories = categoryRows.filter((category) => category.parent_id === null);
  const childCategoriesByParentId = new Map<string, CategoryRow[]>();
  categoryRows
    .filter((category) => category.parent_id !== null)
    .forEach((category) => {
      const parentId = category.parent_id as string;
      childCategoriesByParentId.set(parentId, [
        ...(childCategoriesByParentId.get(parentId) || []),
        category,
      ]);
    });

  const productCountByCategoryId = new Map<string, number>();
  (mappings || []).forEach((mapping) => {
    productCountByCategoryId.set(
      mapping.category_id,
      (productCountByCategoryId.get(mapping.category_id) || 0) + 1
    );
  });

  const primaryLinks = [
    { label: "Catalogo completo", href: "/products" },
    { label: "Explorar juegos", href: "/games" },
    { label: "Categorias", href: "/categories", active: true },
  ];

  const categoryLinks = rootCategories.slice(0, 6).map((category) => ({
    label: category.name,
    href: `/categories/${category.slug}`,
  }));

  const gameLinks = (games || []).slice(0, 6).map((game) => ({
    label: game.name,
    href: `/games/${game.slug}`,
  }));

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker eventName="categories.index.visited" pageType="categories_index" />
      <section className="container-shell py-16">
        <DiscoveryNavSpine
          eyebrow="Marketplace Browse"
          title="Explora el marketplace por categorias"
          description="Esta capa organiza el catalogo por intencion comercial para que encontrar, comparar y llegar al producto correcto sea mas directo."
          path={[
            { label: "Productos", href: "/products" },
            { label: "Categorias", href: "/categories", active: true },
          ]}
          primaryLinks={primaryLinks}
          categoryLinks={categoryLinks}
          gameLinks={gameLinks}
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rootCategories.map((category) => {
            const children = (childCategoriesByParentId.get(category.id) || []).slice(0, 4);
            const totalCount =
              (productCountByCategoryId.get(category.id) || 0) +
              children.reduce((sum, child) => sum + (productCountByCategoryId.get(child.id) || 0), 0);

            return (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="block transition-transform hover:-translate-y-1"
              >
                <Card className="h-full p-6 hover:bg-white/[0.07]">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-white">{category.name}</h2>
                    <Badge>{totalCount} productos</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
                    {category.description || "Entra por esta categoria para reducir friccion de discovery y comparar productos con la misma intencion."}
                  </p>

                  {children.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {children.map((child) => (
                        <Badge key={child.id} className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                          {child.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-5 text-sm font-semibold text-white">Abrir categoria</p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
