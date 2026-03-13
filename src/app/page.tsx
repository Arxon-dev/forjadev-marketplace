import { SiteHeader } from "@/components/layout/site-header";
import { Hero } from "@/components/marketplace/hero";
import { ProductCard } from "@/components/marketplace/product-card";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <Hero />

      <section className="container-shell pb-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Productos destacados</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Una vista previa del catálogo inicial.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <ProductCard title="Elite Raid Controller" author="Elite" category="Plugin" price="€24.99" compatibility="Rust" />
          <ProductCard title="Custom Desert Arena" author="MapForge" category="Mapa" price="Gratis" compatibility="Rust" />
          <ProductCard title="Admin Toolkit Pro" author="ForjaDev" category="Herramienta" price="€14.99" compatibility="Rust" />
        </div>
      </section>
    </main>
  );
}
