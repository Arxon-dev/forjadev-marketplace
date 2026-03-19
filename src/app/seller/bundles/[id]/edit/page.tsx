"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BundleForm } from "@/components/seller/bundle-form";
import { SiteHeader } from "@/components/layout/site-header";
import { createClient } from "@/lib/supabase/client";

export default function SellerEditBundlePage() {
  const router = useRouter();
  const params = useParams();
  const bundleId = params.id as string;
  const [bundleExists, setBundleExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBundle = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("bundles").select("id").eq("id", bundleId).maybeSingle();
      setBundleExists(Boolean(data));
      setLoading(false);
    };

    if (bundleId) {
      fetchBundle();
    }
  }, [bundleId]);

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

  if (!bundleExists) {
    return (
      <main>
        <SiteHeader />
        <section className="container-shell py-16">
          <div className="text-center text-red-400">Bundle no encontrado</div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <h1 className="text-3xl font-bold text-white">Editar bundle</h1>
        <p className="mt-2 text-[var(--text-soft)]">
          Ajusta la composicion y el pricing de tu bundle.
        </p>

        <div className="mt-12">
          <BundleForm bundleId={bundleId} onSuccess={() => router.push("/seller")} />
        </div>
      </section>
    </main>
  );
}
