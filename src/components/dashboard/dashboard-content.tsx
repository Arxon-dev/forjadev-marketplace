"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollectionForm } from "@/components/community/collection-form";
import { ProductCard } from "@/components/marketplace/product-card";
import { DownloadButton } from "@/components/downloads/download-button";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";
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

interface WishlistRow {
  id: string;
  created_at: string;
  product: ProductRow | null;
}

interface FollowedVendorRow {
  id: string;
  created_at: string;
  vendor: {
    id: string;
    store_name: string;
    slug: string;
    bio: string | null;
  } | null;
}

interface WishlistQueryRow {
  id: string;
  created_at: string;
  product: ProductRow[] | ProductRow | null;
}

interface FollowedVendorQueryRow {
  id: string;
  created_at: string;
  vendor:
    | {
        id: string;
        store_name: string;
        slug: string;
        bio: string | null;
      }[]
    | {
        id: string;
        store_name: string;
        slug: string;
        bio: string | null;
      }
    | null;
}

interface CollectionProductRow {
  id: string;
  title: string | null;
  slug: string | null;
}

interface UserCollectionRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  itemCount: number;
  previewProducts: CollectionProductRow[];
}

interface UserCollectionQueryRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface CollectionItemQueryRow {
  collection_id: string;
  product: ProductRow[] | ProductRow | null;
}

interface ActivityFeedRow {
  id: string;
  title: string;
  description: string;
  href: string;
  accent: string;
  occurredAt: string;
}

interface LinkedIdentityRow {
  id: string;
  provider: "discord" | "steam";
  provider_email: string | null;
  provider_username: string | null;
}

interface DashboardRecommendationRow {
  id: string;
  title: string;
  slug: string;
  author: string;
  categoryName: string;
  recommendationReason: string;
  price_cents: number;
  is_free: boolean;
  compatibility: string | null;
  featured_image_url: string | null;
  rating_average: number;
  rating_count: number;
}

export function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [wishlists, setWishlists] = useState<WishlistRow[]>([]);
  const [followedSellers, setFollowedSellers] = useState<FollowedVendorRow[]>([]);
  const [collections, setCollections] = useState<UserCollectionRow[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedRow[]>([]);
  const [linkedIdentities, setLinkedIdentities] = useState<LinkedIdentityRow[]>([]);
  const [recommendations, setRecommendations] = useState<DashboardRecommendationRow[]>([]);
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

        const [
          { data: notificationsData },
          { data: wishlistData },
          { data: followedSellerData },
          { data: collectionsData },
          { data: identitiesData },
          recommendationsData,
        ] =
          await Promise.all([
            supabase
              .from("user_notifications")
              .select("id, kind, title, body, href, entity_type, entity_id, metadata, is_read, read_at, created_at")
              .eq("recipient_user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(8),
            supabase
              .from("wishlists")
              .select("id, created_at, product:products(id, title, slug)")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(6),
            supabase
              .from("seller_followers")
              .select("id, created_at, vendor:vendors(id, store_name, slug, bio)")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(6),
            supabase
              .from("collections")
              .select("id, title, slug, description, is_public, created_at, updated_at")
              .eq("user_id", user.id)
              .order("updated_at", { ascending: false })
              .limit(6),
            supabase
              .from("user_provider_identities")
              .select("id, provider, provider_email, provider_username")
              .eq("user_id", user.id)
              .order("provider", { ascending: true }),
            fetch("/api/recommendations/personalized?limit=3", { cache: "no-store" })
              .then(async (response) => {
                if (!response.ok) {
                  return [] as DashboardRecommendationRow[];
                }

                const payload = (await response.json()) as {
                  recommendations?: DashboardRecommendationRow[];
                };

                return payload.recommendations || [];
              })
              .catch(() => [] as DashboardRecommendationRow[]),
          ]);

        const collectionRows = (collectionsData || []) as UserCollectionQueryRow[];
        const collectionIds = collectionRows.map((collection) => collection.id);
        const wishlistRows = ((wishlistData || []) as WishlistQueryRow[]).map((wishlist) => ({
          id: wishlist.id,
          created_at: wishlist.created_at,
          product: Array.isArray(wishlist.product) ? wishlist.product[0] || null : wishlist.product,
        }));
        const followedSellerRows = ((followedSellerData || []) as FollowedVendorQueryRow[]).map((follow) => ({
          id: follow.id,
          created_at: follow.created_at,
          vendor: Array.isArray(follow.vendor) ? follow.vendor[0] || null : follow.vendor,
        }));
        const { data: collectionItemsData } =
          collectionIds.length > 0
            ? await supabase
                .from("collection_items")
                .select("collection_id, product:products(id, title, slug)")
                .in("collection_id", collectionIds)
                .order("sort_order", { ascending: true })
                .order("created_at", { ascending: true })
            : { data: [] as CollectionItemQueryRow[] };

        const collectionItemsByCollectionId = new Map<string, CollectionProductRow[]>();
        ((collectionItemsData || []) as CollectionItemQueryRow[]).forEach((item) => {
          const product = Array.isArray(item.product) ? item.product[0] || null : item.product;

          if (!product) {
            return;
          }

          const current = collectionItemsByCollectionId.get(item.collection_id) || [];
          current.push(product);
          collectionItemsByCollectionId.set(item.collection_id, current);
        });

        const previewFeed: ActivityFeedRow[] = [
          ...followedSellerRows
            .filter((follow) => follow.vendor?.slug)
            .slice(0, 2)
            .map((follow) => ({
              id: `follow-${follow.id}`,
              title: `Sigue activa la tienda ${follow.vendor?.store_name || "Tienda"}`,
              description:
                follow.vendor?.bio ||
                "Revisa su catalogo publico para detectar nuevos productos o cambios recientes.",
              href: `/seller/${follow.vendor?.slug}`,
              accent: "Seguimiento",
              occurredAt: follow.created_at,
            })),
          ...wishlistRows
            .filter((wishlist) => wishlist.product?.slug)
            .slice(0, 2)
            .map((wishlist) => ({
              id: `wishlist-${wishlist.id}`,
              title: `${wishlist.product?.title || "Producto"} sigue en tu radar`,
              description:
                "Tus wishlists son la mejor base para volver al marketplace con intencion clara.",
              href: `/products/${wishlist.product?.slug}`,
              accent: "Wishlist",
              occurredAt: wishlist.created_at,
            })),
          ...collectionRows.slice(0, 2).map((collection) => ({
            id: `collection-${collection.id}`,
            title: `Tu coleccion ${collection.title} esta lista para crecer`,
            description:
              collection.description ||
              "Actualizala con nuevos productos o compartela como curacion publica.",
            href: `/collections/${collection.slug}`,
            accent: "Coleccion",
            occurredAt: collection.updated_at,
          })),
        ]
          .sort(
            (left, right) =>
              new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
          )
          .slice(0, 4);

        setNotifications((notificationsData || []) as UserNotificationRow[]);
        setLinkedIdentities((identitiesData || []) as LinkedIdentityRow[]);
        setRecommendations(recommendationsData);
        setWishlists(wishlistRows);
        setFollowedSellers(followedSellerRows);
        setCollections(
          collectionRows.map((collection) => {
            const previewProducts = collectionItemsByCollectionId.get(collection.id) || [];

            return {
              ...collection,
              itemCount: previewProducts.length,
              previewProducts: previewProducts.slice(0, 3),
            };
          })
        );
        setActivityFeed(previewFeed);
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
          <div>
            <label className="block text-sm text-[var(--text-soft)]">Identidades conectadas</label>
            {linkedIdentities.length > 0 ? (
              <div className="mt-2 space-y-2">
                {linkedIdentities.map((identity) => (
                  <div
                    key={identity.id}
                    className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                      {identity.provider}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {identity.provider_username ||
                        identity.provider_email ||
                        "Cuenta vinculada correctamente"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[var(--text-soft)]">Sin conexiones sociales todavia</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-12 rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Para ti</h2>
            <p className="mt-2 text-[var(--text-soft)]">
              Recomendaciones personalizadas a partir de tu wishlist, tus compras, tus descargas y los sellers que sigues.
            </p>
          </div>
          <Link
            href="/products?sort=quality_trust"
            className="text-sm font-semibold text-white hover:underline"
            onClick={() =>
              trackMarketplaceEvent({
                eventName: "dashboard.personalized_recommendations.cta.clicked",
                pageType: "dashboard",
                entityType: "page",
                entityId: "products",
              })
            }
          >
            Explorar catalogo completo
          </Link>
        </div>

        {recommendations.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                author={product.author}
                category={product.categoryName}
                price={product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`}
                promoLabel={product.recommendationReason}
                compatibility={product.compatibility || "Rust"}
                ratingAverage={product.rating_average}
                ratingCount={product.rating_count}
                href={`/products/${product.slug}`}
                imageUrl={product.featured_image_url}
                tracking={{
                  pageType: "dashboard",
                  entityId: product.id,
                  metadata: {
                    source: "personalized_recommendations",
                    reason: product.recommendationReason,
                  },
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-10 text-center">
            <p className="text-[var(--text-soft)]">
              Todavia no hay suficiente senal para personalizar recomendaciones. Guarda productos, compra recursos o sigue sellers para activarlas.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Wishlist</h2>
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              {wishlists.length} guardados
            </div>
          </div>

          {wishlists.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-10 text-center">
              <p className="text-[var(--text-soft)]">
                Aun no has guardado productos. Usa la wishlist para seguir recursos que te interesan.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {wishlists.map((wishlist) => (
                <div
                  key={wishlist.id}
                  className="rounded-2xl border border-white/10 bg-black/10 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">
                        {wishlist.product?.title || "Producto"}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        Guardado el {new Date(wishlist.created_at).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                    {wishlist.product?.slug ? (
                      <Link href={`/products/${wishlist.product.slug}`} className="text-sm text-white hover:underline">
                        Ver
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Creadores que sigues</h2>
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              {followedSellers.length} siguiendo
            </div>
          </div>

          {followedSellers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-10 text-center">
              <p className="text-[var(--text-soft)]">
                Todavia no sigues sellers. Sigue tiendas para volver rapido a sus catalogos.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {followedSellers.map((follow) => (
                <div
                  key={follow.id}
                  className="rounded-2xl border border-white/10 bg-black/10 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">
                        {follow.vendor?.store_name || "Tienda"}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {follow.vendor?.bio || "Seller activo dentro del marketplace."}
                      </p>
                    </div>
                    {follow.vendor?.slug ? (
                      <Link href={`/seller/${follow.vendor.slug}`} className="text-sm text-white hover:underline">
                        Ver
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Actividad relevante</h2>
            <p className="mt-2 text-[var(--text-soft)]">
              Un acceso rapido a las senales que ya has ido construyendo con tus follows, wishlist y colecciones.
            </p>
          </div>
          <Link
            href="/feed"
            className="text-sm font-semibold text-white hover:underline"
            onClick={() =>
              trackMarketplaceEvent({
                eventName: "activity.feed.cta.clicked",
                pageType: "dashboard",
                entityType: "page",
                entityId: "feed",
              })
            }
          >
            Abrir feed completo
          </Link>
        </div>

        {activityFeed.length > 0 ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {activityFeed.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/10 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                      {item.accent}
                    </p>
                    <h3 className="mt-2 font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">{item.description}</p>
                    <p className="mt-3 text-xs text-[var(--text-soft)]">
                      {new Date(item.occurredAt).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <Link href={item.href} className="text-sm text-white hover:underline">
                    Ver
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-10 text-center">
            <p className="text-[var(--text-soft)]">
              Todavia no hay suficiente senal para poblar el feed. Sigue sellers y guarda productos para activarlo.
            </p>
          </div>
        )}
      </div>

      <div className="mt-12 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <CollectionForm
          onCreated={(collection) => {
            setCollections((current) => [
              {
                id: collection.id,
                title: collection.title,
                slug: collection.slug,
                description: collection.description,
                is_public: collection.is_public,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                itemCount: collection.item_count,
                previewProducts: [],
              },
              ...current,
            ]);
          }}
        />

        <div className="rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Tus colecciones</h2>
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              {collections.length} activas
            </div>
          </div>

          {collections.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-10 text-center">
              <p className="text-[var(--text-soft)]">
                Todavia no has creado colecciones. Curar listas propias es una buena forma de volver al catalogo con criterio.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="rounded-2xl border border-white/10 bg-black/10 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">{collection.title}</h3>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                          {collection.is_public ? "Publica" : "Privada"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--text-soft)]">
                        {collection.description || "Coleccion personal para organizar productos y volver rapido a ellos."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {collection.previewProducts.map((product) =>
                          product.slug ? (
                            <Link
                              key={product.id}
                              href={`/products/${product.slug}`}
                              className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--text-soft)] transition hover:border-white/20 hover:text-white"
                            >
                              {product.title || "Producto"}
                            </Link>
                          ) : null
                        )}
                        {collection.itemCount > collection.previewProducts.length ? (
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--text-soft)]">
                            +{collection.itemCount - collection.previewProducts.length} mas
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--text-soft)]">
                      <p>{collection.itemCount} productos</p>
                      <p className="mt-2">
                        {new Date(collection.updated_at).toLocaleDateString("es-ES")}
                      </p>
                      <Link
                        href={`/collections/${collection.slug}`}
                        className="mt-3 inline-block text-sm text-white hover:underline"
                      >
                        Ver publica
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
