import { SiteHeader } from "@/components/layout/site-header";

export default function ProductsPage() {
  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <h1 className="text-3xl font-bold text-white">Productos</h1>
        <p className="mt-3 text-[var(--text-soft)]">
          Aquí irá el listado completo con filtros, búsqueda y categorías.
        </p>
      </section>
    </main>
  );
}
