import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Navegar por categoria</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Entra al catalogo desde la intencion correcta y reduce friccion al descubrir.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/products?category=${category.slug}`}
            className="block transition-transform hover:-translate-y-1"
          >
            <Card className="h-full p-5 hover:bg-white/[0.07]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                <Badge>Explorar</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
                {category.description || "Descubre productos curados dentro de esta categoria."}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
