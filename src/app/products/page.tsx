import { SiteHeader } from "@/components/layout/site-header";
import { ProductCard } from "@/components/marketplace/product-card";
import { ProductFilters } from "@/components/marketplace/product-filters";
import { createClient } from "@/lib/supabase/server";

interface ProductsPageProps {
  searchParams?: Promise<{
    q?: string;
    pricing?: string;
    sort?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = (await searchParams) || {};
  const query = params.q?.trim() || "";
  const pricing = params.pricing || "all";
  const sort = params.sort || "newest";

  const supabase = await createClient();
  let productsQuery = supabase
    .from("products")
    .select("id, vendor_id, title, slug, price_cents, is_free, compatibility, featured_image_url")
    .eq("moderation_status", "approved");

  if (query) {
    productsQuery = productsQuery.ilike("title", `%${query}%`);
  }

  if (pricing === "free") {
    productsQuery = productsQuery.eq("is_free", true);
  } else if (pricing === "paid") {
    productsQuery = productsQuery.eq("is_free", false);
  }

  if (sort === "price_asc") {
    productsQuery = productsQuery.order("price_cents", { ascending: true });
  } else if (sort === "price_desc") {
    productsQuery = productsQuery.order("price_cents", { ascending: false });
  } else if (sort === "title") {
    productsQuery = productsQuery.order("title", { ascending: true });
  } else {
    productsQuery = productsQuery.order("created_at", { ascending: false });
  }

  const { data: products } = await productsQuery;
  const vendorIds = Array.from(new Set((products || []).map((product) => product.vendor_id)));
  const { data: vendors } = vendorIds.length
    ? await supabase.from("vendors").select("id, store_name").in("id", vendorIds)
    : { data: [] };

  const vendorById = new Map((vendors || []).map((vendor) => [vendor.id, vendor.store_name]));

  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <h1 className="text-3xl font-bold text-white">Productos</h1>
        <p className="mt-3 text-[var(--text-soft)]">
          Explora los productos aprobados que ya estan disponibles en el marketplace.
        </p>

        <ProductFilters
          initialSearch={query}
          initialPricing={pricing}
          initialSort={sort}
        />

        {products && products.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                author={vendorById.get(product.vendor_id) || "ForjaDev"}
                category="Plugin"
                price={product.is_free ? "Gratis" : `€${(product.price_cents / 100).toFixed(2)}`}
                compatibility={product.compatibility || "Rust"}
                href={`/products/${product.slug}`}
                imageUrl={product.featured_image_url}
              />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">
              No encontramos productos para estos filtros.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
