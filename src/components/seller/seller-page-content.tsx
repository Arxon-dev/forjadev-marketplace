"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SellerAnalyticsPanel } from "./seller-analytics-panel";
import { SellerCampaignManager } from "./seller-campaign-manager";
import { SellerSales } from "./seller-sales";
import { SellerStats } from "./seller-stats";
import { SellerStoreProfileForm } from "./seller-store-profile-form";
import { SellerSupportQueue } from "./seller-support-queue";

interface SellerPageProps {
  userId: string;
}

export function SellerPageContent({ userId }: SellerPageProps) {
  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeller, setIsSeller] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profile?.role === "seller") {
        setIsSeller(true);

        const { data: vendorData } = await supabase
          .from("vendors")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (vendorData) {
          setVendor(vendorData);

          const [{ data: productsData }, { data: bundlesData }] = await Promise.all([
            supabase
              .from("products")
              .select("*")
              .eq("vendor_id", vendorData.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("bundles")
              .select("*")
              .eq("vendor_id", vendorData.id)
              .order("updated_at", { ascending: false }),
          ]);

          setProducts(productsData || []);
          setBundles(bundlesData || []);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return <div className="text-center text-[var(--text-soft)]">Cargando...</div>;
  }

  if (!isSeller) {
    return (
      <section className="container-shell py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold text-white">Comienza a vender en ForjaDev</h1>
          <p className="mt-4 text-[var(--text-soft)]">
            Abre una tienda y empieza a compartir tus productos con la comunidad.
          </p>
          <Link href="/seller/onboarding">
            <Button className="mt-8">Crear tienda</Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container-shell py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{vendor?.store_name}</h1>
          <p className="mt-2 text-[var(--text-soft)]">{vendor?.bio}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/seller/bundles/new">
            <Button variant="secondary">Nuevo bundle</Button>
          </Link>
          <Link href="/seller/new">
            <Button>Nuevo producto</Button>
          </Link>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="mb-6 text-xl font-semibold text-white">Estadisticas</h2>
        <SellerStats vendorId={vendor?.id} />
      </div>

      {vendor ? (
        <div className="mb-12">
          <SellerStoreProfileForm
            vendor={vendor}
            onUpdated={(updates) =>
              setVendor((current: any) => (current ? { ...current, ...updates } : current))
            }
          />
        </div>
      ) : null}

      {vendor?.id ? (
        <div className="mb-12">
          <SellerAnalyticsPanel vendorId={vendor.id} />
        </div>
      ) : null}

      {vendor?.id ? (
        <div className="mb-12">
          <SellerCampaignManager vendorId={vendor.id} />
        </div>
      ) : null}

      <div className="mb-12">
        <h2 className="mb-6 text-xl font-semibold text-white">Ventas y licencias recientes</h2>
        <SellerSales vendorId={vendor?.id} />
      </div>

      {vendor?.id ? (
        <div className="mb-12">
          <SellerSupportQueue vendorId={vendor.id} />
        </div>
      ) : null}

      <div>
        <h2 className="mb-6 text-xl font-semibold text-white">Mis productos</h2>
        {products.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-8 py-12 text-center backdrop-blur">
            <p className="text-[var(--text-soft)]">No tienes productos aun.</p>
            <Link href="/seller/new" className="mt-4 inline-block">
              <Button>Crear primer producto</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <div>
                  <h3 className="font-semibold text-white">{product.title}</h3>
                  <p className="text-sm text-[var(--text-soft)]">
                    Estado: <span className="capitalize">{product.moderation_status}</span>
                  </p>
                  {product.rejection_reason ? (
                    <p className="mt-1 text-sm text-amber-300">
                      Motivo: {product.rejection_reason}
                    </p>
                  ) : null}
                </div>
                <Link href={`/seller/${product.id}/edit`}>
                  <Button variant="ghost">Editar</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h2 className="mb-6 text-xl font-semibold text-white">Mis bundles</h2>
        {bundles.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-8 py-12 text-center backdrop-blur">
            <p className="text-[var(--text-soft)]">Aun no has creado bundles.</p>
            <Link href="/seller/bundles/new" className="mt-4 inline-block">
              <Button variant="secondary">Crear primer bundle</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bundles.map((bundle) => (
              <div
                key={bundle.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <div>
                  <h3 className="font-semibold text-white">{bundle.title}</h3>
                  <p className="text-sm text-[var(--text-soft)]">
                    Estado: <span className="capitalize">{bundle.is_active ? "activo" : "inactivo"}</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Precio: EUR {(bundle.price_cents / 100).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link href={`/bundles/${bundle.slug}`}>
                    <Button variant="ghost">Ver</Button>
                  </Link>
                  <Link href={`/seller/bundles/${bundle.id}/edit`}>
                    <Button variant="ghost">Editar</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
