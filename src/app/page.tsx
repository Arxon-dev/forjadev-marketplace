import { SiteHeader } from "@/components/layout/site-header";
import { Hero } from "@/components/marketplace/hero";
import { ProductCard } from "@/components/marketplace/product-card";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createServerSupabaseClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("moderation_status", "approved")
    .limit(3);

  return (
    <main>
      <SiteHeader />
      <Hero />

      <section className="container-shell pb-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Productos destacados</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Vista previa del catálogo inicial conectado a Supabase.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products && products.length > 0 ? (
            products.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                author="Autor"
                category="Plugin"
                price={product.is_free ? "Gratis" : `€${(product.price_cents / 100).toFixed(2)}`}
                compatibility={product.compatibility ?? "Rust"}
              />
            ))
          ) : (
            <>
              <ProductCard title="Elite Raid Controller" author="Elite" category="Plugin" price="€24.99" compatibility="Rust" />
              <ProductCard title="Custom Desert Arena" author="MapForge" category="Mapa" price="Gratis" compatibility="Rust" />
              <ProductCard title="Admin Toolkit Pro" author="ForjaDev" category="Herramienta" price="€14.99" compatibility="Rust" />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
