"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/layout/site-header";
import { SellerPageContent } from "@/components/seller/seller-page-content";

export default function SellerPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    };
    getUser();
  }, []);

  if (!userId) {
    return (
      <main>
        <SiteHeader />
        <section className="container-shell flex min-h-screen items-center justify-center py-16">
          <div className="text-center text-[var(--text-soft)]">Cargando...</div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <SiteHeader />
      <SellerPageContent userId={userId} />
    </main>
  );
}
