"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { createClient } from "@/lib/supabase/client";
import { ProductForm } from "@/components/seller/product-form";

export default function SellerEditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      const supabase = createClient();

      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      setProduct(data);
      setLoading(false);
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const handleSuccess = () => {
    router.push("/seller");
  };

  if (loading) {
    return (
      <main>
        <SiteHeader />
        <section className="container-shell py-16">
          <div className="text-center text-[var(--text-soft)]">Cargando...</div>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main>
        <SiteHeader />
        <section className="container-shell py-16">
          <div className="text-center text-red-400">Producto no encontrado</div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <h1 className="text-3xl font-bold text-white">Editar producto</h1>
        <p className="mt-2 text-[var(--text-soft)]">
          Actualiza los detalles de tu producto
        </p>

        <div className="mt-12">
          <ProductForm productId={productId} onSuccess={handleSuccess} />
        </div>
      </section>
    </main>
  );
}
