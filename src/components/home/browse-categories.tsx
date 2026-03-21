import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CommerceSectionHeading,
  commercePanelClassName,
} from "@/components/marketplace/commerce-surface-system";

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
            <Card className={`${commercePanelClassName("tile")} h-full p-6 hover:bg-white/[0.08]`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                <Badge className="border-[var(--primary)]/25 bg-[var(--primary)]/15 text-white">
                  Explorar
                </Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
                {category.description || "Descubre productos curados dentro de esta categoria."}
              </p>
              <p className="mt-5 text-sm font-semibold text-white">Entrar a esta ruta comercial</p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
