import { SiteHeader } from "@/components/layout/site-header";
import { Hero } from "@/components/marketplace/hero";
import { ProductCard } from "@/components/marketplace/product-card";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, vendor_id, title, slug, price_cents, is_free, compatibility, featured_image_url")
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(6);

  const vendorIds = Array.from(new Set((products || []).map((product) => product.vendor_id)));
  const { data: vendors } = vendorIds.length
    ? await supabase.from("vendors").select("id, store_name").in("id", vendorIds)
    : { data: [] };

  const vendorById = new Map((vendors || []).map((vendor) => [vendor.id, vendor.store_name]));

  return (
    <main>
      <SiteHeader />
      <Hero />

      <section className="container-shell pb-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Productos destacados</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Vista previa del catalogo mas reciente conectado a Supabase.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products && products.length > 0 ? (
            products.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                author={vendorById.get(product.vendor_id) || "ForjaDev"}
                category="Plugin"
                price={product.is_free ? "Gratis" : `EUR ${((product.price_cents || 0) / 100).toFixed(2)}`}
                compatibility={product.compatibility ?? "Rust"}
                href={`/products/${product.slug}`}
                imageUrl={product.featured_image_url}
              />
            ))
          ) : (
            <>
              <ProductCard
                title="Elite Raid Controller"
                author="Elite"
                category="Plugin"
                price="EUR 24.99"
                compatibility="Rust"
              />
              <ProductCard
                title="Custom Desert Arena"
                author="MapForge"
                category="Mapa"
                price="Gratis"
                compatibility="Rust"
              />
              <ProductCard
                title="Admin Toolkit Pro"
                author="ForjaDev"
                category="Herramienta"
                price="EUR 14.99"
                compatibility="Rust"
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
