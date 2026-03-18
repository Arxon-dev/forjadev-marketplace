"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadButton } from "@/components/downloads/download-button";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface ProfileRow {
  display_name: string | null;
  username: string | null;
  role: string | null;
}

interface ProductRow {
  id: string;
  title: string | null;
  slug: string | null;
}

interface DownloadRow {
  id: string;
  downloaded_at: string;
  product: ProductRow | null;
}

interface LicenseRow {
  id: string;
  license_key: string;
  status: string;
  issued_at: string;
}

interface OrderItemRow {
  id: string;
  product: ProductRow | null;
  license: LicenseRow | LicenseRow[] | null;
}

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  total_cents: number;
  items: OrderItemRow[] | null;
}

interface UserNotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [notifications, setNotifications] = useState<UserNotificationRow[]>([]);
  const [notificationBusy, setNotificationBusy] = useState(false);
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

        setProfile(profileData as ProfileRow | null);

        const { data: downloadsData } = await supabase
          .from("downloads")
          .select("*, product:products(*)")
          .eq("user_id", user.id)
          .order("downloaded_at", { ascending: false })
          .limit(10);

        setDownloads((downloadsData || []) as DownloadRow[]);

        const { data: ordersData } = await supabase
          .from("orders")
          .select(
            "*, items:order_items(*, product:products(id, title, slug), license:licenses(id, license_key, status, issued_at))"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        setOrders((ordersData || []) as OrderRow[]);

        const { data: notificationsData } = await supabase
          .from("user_notifications")
          .select("id, kind, title, body, href, entity_type, entity_id, metadata, is_read, read_at, created_at")
          .eq("recipient_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8);

        setNotifications((notificationsData || []) as UserNotificationRow[]);
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

  const unreadNotifications = notifications.filter((notification) => !notification.is_read);

  const markNotificationAsRead = async (notificationId: string, href?: string | null) => {
    const supabase = createClient();
    setNotificationBusy(true);

    const timestamp = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true, read_at: timestamp }
          : notification
      )
    );

    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: timestamp })
      .eq("id", notificationId);

    setNotificationBusy(false);

    if (error) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: false, read_at: null }
            : notification
        )
      );
      return;
    }

    if (href) {
      router.push(href);
      router.refresh();
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!user || unreadNotifications.length === 0) {
      return;
    }

    const supabase = createClient();
    const timestamp = new Date().toISOString();
    const unreadIds = unreadNotifications.map((notification) => notification.id);
    setNotificationBusy(true);
    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.includes(notification.id)
          ? { ...notification, is_read: true, read_at: timestamp }
          : notification
      )
    );

    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: timestamp })
      .eq("recipient_user_id", user.id)
      .eq("is_read", false);

    setNotificationBusy(false);

    if (error) {
      setNotifications((current) =>
        current.map((notification) =>
          unreadIds.includes(notification.id)
            ? { ...notification, is_read: false, read_at: null }
            : notification
        )
      );
    }
  };

  return (
    <section className="container-shell py-16">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white">Mi Dashboard</h1>
        <p className="mt-2 text-[var(--text-soft)]">Bienvenido, {profile?.display_name}</p>
      </div>

      <div className="mb-12 rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Bandeja interna</h2>
            <p className="mt-2 text-[var(--text-soft)]">
              Mantente al dia con soporte, cambios de estado y actividad relevante de tu cuenta.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              {unreadNotifications.length} sin leer
            </div>
            <button
              type="button"
              onClick={markAllNotificationsAsRead}
              disabled={notificationBusy || unreadNotifications.length === 0}
              className="text-sm text-[var(--primary)] transition hover:text-white disabled:cursor-not-allowed disabled:text-[var(--text-soft)]"
            >
              Marcar todo como leido
            </button>
          </div>
        </div>

        {notifications.length > 0 ? (
          <div className="mt-6 space-y-4">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-2xl border px-4 py-4 ${
                  notification.is_read
                    ? "border-white/10 bg-black/10"
                    : "border-[var(--primary)]/30 bg-[var(--primary)]/10"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-white">{notification.title}</h3>
                      {!notification.is_read ? (
                        <span className="rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                          Nueva
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">{notification.body}</p>
                    <p className="mt-3 text-xs text-[var(--text-soft)]">
                      {new Date(notification.created_at).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {notification.href ? (
                      <button
                        type="button"
                        onClick={() => markNotificationAsRead(notification.id, notification.href)}
                        disabled={notificationBusy}
                        className="text-sm font-medium text-white transition hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:text-[var(--text-soft)]"
                      >
                        Abrir
                      </button>
                    ) : null}
                    {!notification.is_read ? (
                      <button
                        type="button"
                        onClick={() => markNotificationAsRead(notification.id)}
                        disabled={notificationBusy}
                        className="text-sm font-medium text-[var(--primary)] transition hover:text-white disabled:cursor-not-allowed disabled:text-[var(--text-soft)]"
                      >
                        Marcar leida
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-10 text-center">
            <p className="text-[var(--text-soft)]">
              Tu bandeja interna esta limpia. Las nuevas incidencias y respuestas apareceran aqui.
            </p>
          </div>
        )}
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
                  {(order.items || []).map((item) => {
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
