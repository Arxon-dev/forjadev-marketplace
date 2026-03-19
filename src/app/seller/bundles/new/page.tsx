"use client";

import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { BundleForm } from "@/components/seller/bundle-form";

export default function SellerNewBundlePage() {
  const router = useRouter();

  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <h1 className="text-3xl font-bold text-white">Nuevo bundle</h1>
        <p className="mt-2 text-[var(--text-soft)]">
          Crea una oferta premium agrupando varios productos de tu tienda.
        </p>

        <div className="mt-12">
          <BundleForm onSuccess={() => router.push("/seller")} />
        </div>
      </section>
    </main>
  );
}
