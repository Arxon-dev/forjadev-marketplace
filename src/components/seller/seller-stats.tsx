"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SellerStatsProps {
  vendorId: string;
}

export function SellerStats({ vendorId }: SellerStatsProps) {
  const [stats, setStats] = useState({
    productCount: 0,
    downloadCount: 0,
    totalRevenue: 0,
    licenseCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient();

      const { data: products, count: productCount } = await supabase
        .from("products")
        .select("id", { count: "exact" })
        .eq("vendor_id", vendorId);

      const productIds = (products || []).map((product) => product.id);

      if (productIds.length === 0) {
        setStats({
          productCount: productCount || 0,
          downloadCount: 0,
          totalRevenue: 0,
          licenseCount: 0,
        });
        setLoading(false);
        return;
      }

      const { data: downloads } = await supabase
        .from("downloads")
        .select("id")
        .in("product_id", productIds);

      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, price_cents")
        .in("product_id", productIds);

      const { data: licenses } = await supabase
        .from("licenses")
        .select("id")
        .in("product_id", productIds);

      const totalRevenue =
        orderItems?.reduce((sum, item) => sum + (item.price_cents || 0), 0) || 0;

      setStats({
        productCount: productCount || 0,
        downloadCount: downloads?.length || 0,
        totalRevenue,
        licenseCount: licenses?.length || 0,
      });
      setLoading(false);
    };

    fetchStats();
  }, [vendorId]);

  if (loading) {
    return <div className="text-[var(--text-soft)]">Cargando estadisticas...</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur">
        <p className="text-sm text-[var(--text-soft)]">Productos</p>
        <p className="mt-2 text-3xl font-bold text-white">{stats.productCount}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur">
        <p className="text-sm text-[var(--text-soft)]">Descargas</p>
        <p className="mt-2 text-3xl font-bold text-white">{stats.downloadCount}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur">
        <p className="text-sm text-[var(--text-soft)]">Ingresos (EUR)</p>
        <p className="mt-2 text-3xl font-bold text-white">
          {(stats.totalRevenue / 100).toFixed(2)}
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur">
        <p className="text-sm text-[var(--text-soft)]">Licencias</p>
        <p className="mt-2 text-3xl font-bold text-white">{stats.licenseCount}</p>
      </div>
    </div>
  );
}
