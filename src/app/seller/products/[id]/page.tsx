import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { ProductHealthPanel } from "@/components/intelligence/product-health-panel";
import { SellerProductPostSalePanel } from "@/components/seller/seller-product-post-sale-panel";
import { SellerProductWorkspace } from "@/components/seller/seller-product-workspace";
import { requireOwnedProductContext } from "@/lib/auth/seller";
import { getProductHealthSnapshot } from "@/lib/intelligence/product-health";
import { getSellerProductPostSaleSnapshot } from "@/lib/seller/post-sale-visibility";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface SellerProductWorkspacePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SellerProductWorkspacePage({
  params,
}: SellerProductWorkspacePageProps) {
  const { id } = await params;
  const { product, vendor } = await requireOwnedProductContext(id);
  const [postSaleSnapshot, productHealthSnapshot] = await Promise.all([
    getSellerProductPostSaleSnapshot(product.id, vendor.id),
    getProductHealthSnapshot(product.id, vendor.id),
  ]);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">{product.title}</h1>
              <p className="mt-2 text-[var(--text-soft)]">
                Centro operativo del producto con continuidad directa a releases, soporte y capa comercial.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/seller/products/${id}/promotions`}>
                <Button variant="secondary">Promociones y cupones</Button>
              </Link>
              <Link href={`/seller/products/${id}/support`}>
                <Button variant="secondary">Soporte del producto</Button>
              </Link>
              <Link href={`/seller/products/${id}/edit`}>
                <Button variant="ghost">Editar ficha</Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="mb-8">
          <SellerProductPostSalePanel productId={id} snapshot={postSaleSnapshot} />
        </div>
        <div className="mb-8">
          <ProductHealthPanel snapshot={productHealthSnapshot} audience="seller" />
        </div>
        <SellerProductWorkspace productId={id} />
      </section>
    </main>
  );
}
