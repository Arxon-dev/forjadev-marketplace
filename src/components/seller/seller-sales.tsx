"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SellerSalesProps {
  vendorId: string;
}

export function SellerSales({ vendorId }: SellerSalesProps) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      const supabase = createClient();

      const { data: products } = await supabase
        .from("products")
        .select("id, title, slug")
        .eq("vendor_id", vendorId);

      const productIds = (products || []).map((product) => product.id);

      if (productIds.length === 0) {
        setSales([]);
        setLoading(false);
        return;
      }

      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, price_cents, created_at, product:products(id, title, slug), license:licenses(id, license_key, status)")
        .in("product_id", productIds)
        .order("created_at", { ascending: false })
        .limit(12);

      setSales(orderItems || []);
      setLoading(false);
    };

    fetchSales();
  }, [vendorId]);

  if (loading) {
    return <div className="text-[var(--text-soft)]">Cargando ventas...</div>;
  }

  if (sales.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 px-8 py-12 text-center backdrop-blur">
        <p className="text-[var(--text-soft)]">Todavia no tienes ventas registradas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sales.map((sale) => {
        const product = Array.isArray(sale.product) ? sale.product[0] : sale.product;
        const license = Array.isArray(sale.license) ? sale.license[0] : sale.license;

        return (
          <article
            key={sale.id}
            className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{product?.title || "Producto"}</h3>
                <p className="text-sm text-[var(--text-soft)]">
                  Venta: {new Date(sale.created_at).toLocaleString("es-ES")}
                </p>
              </div>
              <p className="text-sm font-medium text-white">
                {sale.price_cents === 0 ? "Gratis" : `EUR ${(sale.price_cents / 100).toFixed(2)}`}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {license ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Licencia</p>
                  <p className="mt-1 font-mono text-xs text-white">{license.license_key}</p>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-soft)]">Sin licencia asociada</p>
              )}

              {product?.slug ? (
                <Link href={`/products/${product.slug}`} className="text-sm text-white hover:underline">
                  Ver producto
                </Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
