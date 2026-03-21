import { ProductCard } from "@/components/marketplace/product-card";
import { CommerceSectionHeading } from "@/components/marketplace/commerce-surface-system";

interface RailProduct {
  id: string;
  title: string;
  author: string;
  category: string;
  price: string;
  originalPrice?: string | null;
  promoLabel?: string | null;
  compatibility: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  href: string;
  imageUrl?: string | null;
  tracking?: {
    pageType: string;
    entityType?: string;
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
      <CommerceSectionHeading
        dataId={`rail-${title.toLowerCase().replace(/\s+/g, "-")}`}
        eyebrow="Discovery rail"
        title={title}
        description={description}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            title={product.title}
            author={product.author}
            category={product.category}
            price={product.price}
            originalPrice={product.originalPrice}
            promoLabel={product.promoLabel}
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
