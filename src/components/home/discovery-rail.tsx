import { ProductCard } from "@/components/marketplace/product-card";

interface RailProduct {
  id: string;
  title: string;
  author: string;
  category: string;
  price: string;
  compatibility: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  href: string;
  imageUrl?: string | null;
  tracking?: {
    pageType: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
  };
}

interface DiscoveryRailProps {
  title: string;
  description: string;
  products: RailProduct[];
}

export function DiscoveryRail({
  title,
  description,
  products,
}: DiscoveryRailProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mt-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">{description}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            title={product.title}
            author={product.author}
            category={product.category}
            price={product.price}
            compatibility={product.compatibility}
            ratingAverage={product.ratingAverage}
            ratingCount={product.ratingCount}
            href={product.href}
            imageUrl={product.imageUrl}
            tracking={product.tracking}
          />
        ))}
      </div>
    </section>
  );
}
