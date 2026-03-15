"use client";

import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { ProductForm } from "@/components/seller/product-form";

export default function SellerNewProductPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push("/seller");
  };

  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <h1 className="text-3xl font-bold text-white">Nuevo producto</h1>
        <p className="mt-2 text-[var(--text-soft)]">
          Completa los detalles de tu producto nuevo
        </p>

        <div className="mt-12">
          <ProductForm onSuccess={handleSuccess} />
        </div>
      </section>
    </main>
  );
}
