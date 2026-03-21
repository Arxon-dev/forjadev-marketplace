import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommerceSectionHeading } from "@/components/marketplace/commerce-surface-system";

interface BrowseCategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface BrowseCategoriesProps {
  categories: BrowseCategoryItem[];
}

export function BrowseCategories({ categories }: BrowseCategoriesProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="mt-16">
      <CommerceSectionHeading
        dataId="home-categories"
        eyebrow="Browse spine"
        title="Navegar por categoria"
        description="Entra al catalogo desde la intencion correcta y reduce friccion al descubrir."
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/products?category=${category.slug}`}
            className="block transition-transform hover:-translate-y-1"
          >
            <Card className="h-full rounded-[1.75rem] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6 hover:bg-white/[0.07]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                <Badge className="border-[var(--primary)]/25 bg-[var(--primary)]/15 text-white">
                  Explorar
                </Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
                {category.description || "Descubre productos curados dentro de esta categoria."}
              </p>
              <p className="mt-5 text-sm font-semibold text-white">Entrar en esta ruta</p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
