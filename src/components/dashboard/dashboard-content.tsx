"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DownloadButton } from "@/components/downloads/download-button";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function DashboardContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfile(profileData);

        const { data: downloadsData } = await supabase
          .from("downloads")
          .select("*, product:products(*)")
          .eq("user_id", user.id)
          .order("downloaded_at", { ascending: false })
          .limit(10);

        setDownloads(downloadsData || []);

        const { data: ordersData } = await supabase
          .from("orders")
          .select(
            "*, items:order_items(*, product:products(id, title, slug), license:licenses(id, license_key, status, issued_at))"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        setOrders(ordersData || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center text-[var(--text-soft)]">Cargando...</div>;
  }

  if (!user) {
    return (
      <section className="container-shell py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Necesitas iniciar sesion</h1>
          <Link href="/login" className="mt-4 inline-block text-blue-400 hover:underline">
            Ir a Login
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container-shell py-16">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white">Mi Dashboard</h1>
        <p className="mt-2 text-[var(--text-soft)]">Bienvenido, {profile?.display_name}</p>
      </div>

      <div className="mb-12 rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h2 className="mb-6 text-xl font-semibold text-white">Informacion de cuenta</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-soft)]">Email</label>
            <p className="mt-1 font-semibold text-white">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-soft)]">Nombre de usuario</label>
            <p className="mt-1 font-semibold text-white">{profile?.username}</p>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-soft)]">Nombre de perfil</label>
            <p className="mt-1 font-semibold text-white">{profile?.display_name}</p>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-soft)]">Rol</label>
            <p className="mt-1 font-semibold text-white capitalize">{profile?.role}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-6 text-xl font-semibold text-white">Tus descargas</h2>
        {downloads.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-8 py-12 text-center backdrop-blur">
            <p className="text-[var(--text-soft)]">No has descargado ningun producto aun.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {downloads.map((download) => (
              <div
                key={download.id}
                className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <h3 className="font-semibold text-white">{download.product?.title}</h3>
                <p className="text-sm text-[var(--text-soft)]">
                  Descargado: {new Date(download.downloaded_at).toLocaleDateString("es-ES")}
                </p>
                {download.product?.id ? (
                  <div className="mt-4">
                    <DownloadButton
                      productId={download.product.id}
                      label="Descargar de nuevo"
                      variant="secondary"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Tus pedidos</h2>
          <div className="flex items-center gap-4">
            <Link href="/orders" className="text-sm text-white hover:underline">
              Ver pedidos
            </Link>
            <Link href="/licenses" className="text-sm text-white hover:underline">
              Ver licencias
            </Link>
          </div>
        </div>
        {orders.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-8 py-12 text-center backdrop-blur">
            <p className="text-[var(--text-soft)]">Aun no tienes pedidos registrados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">Pedido #{order.id.slice(0, 8)}</h3>
                    <p className="text-sm text-[var(--text-soft)]">
                      {new Date(order.created_at).toLocaleDateString("es-ES")} ·{" "}
                      <span className="capitalize">{order.status}</span>
                    </p>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {order.total_cents === 0
                      ? "Gratis"
                      : `EUR ${(order.total_cents / 100).toFixed(2)}`}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {(order.items || []).map((item: any) => {
                    const license = Array.isArray(item.license) ? item.license[0] : item.license;

                    return (
                      <div key={item.id} className="rounded-xl border border-white/10 px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-[var(--text-soft)]">{item.product?.title}</span>
                          {item.product?.slug ? (
                            <Link href={`/products/${item.product.slug}`} className="text-white hover:underline">
                              Ver producto
                            </Link>
                          ) : null}
                        </div>

                        {license ? (
                          <p className="mt-3 font-mono text-xs text-emerald-300">
                            Licencia: {license.license_key}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
