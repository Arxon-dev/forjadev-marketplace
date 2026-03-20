import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { SellerEditProductShell } from "@/components/seller/seller-edit-product-shell";
import { requireOwnedProductContext } from "@/lib/auth/seller";

interface SellerEditProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SellerEditProductPage({
  params,
}: SellerEditProductPageProps) {
  const { id } = await params;
  const { product } = await requireOwnedProductContext(id);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <h1 className="text-3xl font-bold text-white">Editar ficha del producto</h1>
        <p className="mt-2 text-[var(--text-soft)]">
          Ajusta metadata, contenido y politicas de <span className="text-white">{product.title}</span>.
        </p>

        <div className="mt-12">
          <SellerEditProductShell productId={id} />
        </div>
      </section>
    </main>
  );
}
