import Link from "next/link";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type MarketplaceEventRow = {
  id: string;
  actor_user_id: string | null;
  session_id: string;
  event_name: string;
  page_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json | null;
  created_at: string;
};

type ProfileLookupRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
};

interface AdminAnalyticsPageProps {
  searchParams?: Promise<{
    range?: string;
    event?: string;
    page?: string;
  }>;
}

const RANGE_OPTIONS = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
} as const;

function formatMetadata(metadata: Json | null) {
  if (!metadata) {
    return "Sin metadata";
  }

  return JSON.stringify(metadata, null, 2);
}

function buildTopCounts<T>(items: T[], pickKey: (item: T) => string | null | undefined, limit = 5) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const key = pickKey(item);
    if (!key) {
      return;
    }

    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

export default async function AdminAnalyticsPage({
  searchParams,
}: AdminAnalyticsPageProps) {
  await requireAdminContext();
  const adminSupabase = createAdminClient();
  const params = (await searchParams) || {};
  const selectedRange = params.range && params.range in RANGE_OPTIONS ? params.range : "7d";
  const selectedEvent = params.event || "all";
  const selectedPage = params.page || "all";

  const days = RANGE_OPTIONS[selectedRange as keyof typeof RANGE_OPTIONS];
  const since = new Date();
  since.setDate(since.getDate() - days);

  let eventsQuery = adminSupabase
    .from("marketplace_events")
    .select(
      "id, actor_user_id, session_id, event_name, page_type, entity_type, entity_id, metadata, created_at"
    )
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(300) as any;

  if (selectedEvent !== "all") {
    eventsQuery = eventsQuery.eq("event_name", selectedEvent);
  }

  if (selectedPage !== "all") {
    eventsQuery = eventsQuery.eq("page_type", selectedPage);
  }

  const { data: events } = (await eventsQuery) as { data: MarketplaceEventRow[] | null };
  const filteredEvents = events || [];

  const actorIds = Array.from(
    new Set(filteredEvents.map((event) => event.actor_user_id).filter(Boolean))
  ) as string[];

  const { data: profiles } = (actorIds.length
    ? await adminSupabase
        .from("profiles")
        .select("id, email, username, display_name")
        .in("id", actorIds)
    : { data: [] as ProfileLookupRow[] }) as { data: ProfileLookupRow[] | null };

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  const eventCounts = {
    total: filteredEvents.length,
    searches: filteredEvents.filter((event) => event.event_name === "search.executed").length,
    clicks: filteredEvents.filter((event) => event.event_name === "product.card.clicked").length,
    categoryVisits: filteredEvents.filter((event) => event.event_name === "category.visited").length,
    gameVisits: filteredEvents.filter((event) => event.event_name === "game.visited").length,
    detailViews: filteredEvents.filter((event) => event.event_name === "product.detail.opened").length,
  };

  const topSearches = buildTopCounts(filteredEvents, (event) => {
    if (event.event_name !== "search.executed" || !event.metadata || typeof event.metadata !== "object") {
      return null;
    }

    const searchValue = (event.metadata as Record<string, Json>).search;
    return typeof searchValue === "string" && searchValue.trim() ? searchValue.trim() : null;
  });

  const topCategories = buildTopCounts(
    filteredEvents,
    (event) => (event.event_name === "category.visited" ? event.entity_id : null)
  );
  const topGames = buildTopCounts(
    filteredEvents,
    (event) => (event.event_name === "game.visited" ? event.entity_id : null)
  );
  const topProductClicks = buildTopCounts(
    filteredEvents,
    (event) =>
      event.event_name === "product.card.clicked" && event.entity_type === "product"
        ? event.entity_id
        : null
  );
  const topProductDetails = buildTopCounts(
    filteredEvents,
    (event) =>
      event.event_name === "product.detail.opened" && event.entity_type === "product"
        ? event.entity_id
        : null
  );

  const availableEvents = Array.from(new Set(filteredEvents.map((event) => event.event_name))).sort();
  const availablePages = Array.from(new Set(filteredEvents.map((event) => event.page_type))).sort();

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Admin</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Analytics de discovery</h1>
            <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
              Supervisa la actividad del marketplace en home, catalogo, landings y fichas para
              iterar discovery con datos reales en lugar de intuicion.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="secondary">Volver a admin</Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Eventos</p>
            <p className="mt-2 text-3xl font-bold text-white">{eventCounts.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Busquedas</p>
            <p className="mt-2 text-3xl font-bold text-white">{eventCounts.searches}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Clicks de card</p>
            <p className="mt-2 text-3xl font-bold text-white">{eventCounts.clicks}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Visitas categoria</p>
            <p className="mt-2 text-3xl font-bold text-white">{eventCounts.categoryVisits}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Visitas juego</p>
            <p className="mt-2 text-3xl font-bold text-white">{eventCounts.gameVisits}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Aperturas ficha</p>
            <p className="mt-2 text-3xl font-bold text-white">{eventCounts.detailViews}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/analytics?range=24h">
            <Button variant={selectedRange === "24h" ? "primary" : "secondary"}>24h</Button>
          </Link>
          <Link href="/admin/analytics?range=7d">
            <Button variant={selectedRange === "7d" ? "primary" : "secondary"}>7d</Button>
          </Link>
          <Link href="/admin/analytics?range=30d">
            <Button variant={selectedRange === "30d" ? "primary" : "secondary"}>30d</Button>
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/admin/analytics?range=${selectedRange}`}>
            <Button variant={selectedEvent === "all" ? "primary" : "secondary"}>Todos los eventos</Button>
          </Link>
          {availableEvents.map((eventName) => (
            <Link key={eventName} href={`/admin/analytics?range=${selectedRange}&event=${eventName}`}>
              <Button variant={selectedEvent === eventName ? "primary" : "secondary"}>
                {eventName}
              </Button>
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/admin/analytics?range=${selectedRange}${selectedEvent !== "all" ? `&event=${selectedEvent}` : ""}`}>
            <Button variant={selectedPage === "all" ? "primary" : "secondary"}>Todas las paginas</Button>
          </Link>
          {availablePages.map((pageType) => (
            <Link
              key={pageType}
              href={`/admin/analytics?range=${selectedRange}${selectedEvent !== "all" ? `&event=${selectedEvent}` : ""}&page=${pageType}`}
            >
              <Button variant={selectedPage === pageType ? "primary" : "secondary"}>
                {pageType}
              </Button>
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Top busquedas</h2>
            <div className="mt-4 space-y-3">
              {topSearches.length > 0 ? (
                topSearches.map(([term, count]) => (
                  <div key={term} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3">
                    <p className="truncate text-white">{term}</p>
                    <p className="text-sm font-semibold text-[var(--text-soft)]">{count}</p>
                  </div>
                ))
              ) : (
                <p className="text-[var(--text-soft)]">Sin datos de busqueda para este rango.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Top categorias visitadas</h2>
            <div className="mt-4 space-y-3">
              {topCategories.length > 0 ? (
                topCategories.map(([entityId, count]) => (
                  <div key={entityId} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3">
                    <p className="truncate text-white">{entityId}</p>
                    <p className="text-sm font-semibold text-[var(--text-soft)]">{count}</p>
                  </div>
                ))
              ) : (
                <p className="text-[var(--text-soft)]">Sin visitas de categoria en este rango.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Top juegos visitados</h2>
            <div className="mt-4 space-y-3">
              {topGames.length > 0 ? (
                topGames.map(([entityId, count]) => (
                  <div key={entityId} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3">
                    <p className="truncate text-white">{entityId}</p>
                    <p className="text-sm font-semibold text-[var(--text-soft)]">{count}</p>
                  </div>
                ))
              ) : (
                <p className="text-[var(--text-soft)]">Sin visitas de juego en este rango.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Top productos clicados</h2>
            <div className="mt-4 space-y-3">
              {topProductClicks.length > 0 ? (
                topProductClicks.map(([entityId, count]) => (
                  <div key={entityId} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3">
                    <p className="truncate text-white">{entityId}</p>
                    <p className="text-sm font-semibold text-[var(--text-soft)]">{count}</p>
                  </div>
                ))
              ) : (
                <p className="text-[var(--text-soft)]">Sin clicks de producto en este rango.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 xl:col-span-2">
            <h2 className="text-xl font-semibold text-white">Top fichas abiertas</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {topProductDetails.length > 0 ? (
                topProductDetails.map(([entityId, count]) => (
                  <div key={entityId} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3">
                    <p className="truncate text-white">{entityId}</p>
                    <p className="text-sm font-semibold text-[var(--text-soft)]">{count}</p>
                  </div>
                ))
              ) : (
                <p className="text-[var(--text-soft)]">Sin aperturas de ficha en este rango.</p>
              )}
            </div>
          </div>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Eventos recientes</h2>
            <div className="mt-5 space-y-4">
              {filteredEvents.map((event) => {
                const actor = event.actor_user_id ? profileById.get(event.actor_user_id) : null;
                const actorLabel =
                  actor?.display_name ||
                  actor?.username ||
                  actor?.email ||
                  event.actor_user_id ||
                  "Anonimo";

                return (
                  <article
                    key={event.id}
                    className="rounded-2xl border border-white/10 bg-black/10 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-[var(--text-soft)]">Evento</p>
                          <h3 className="text-lg font-semibold text-white">{event.event_name}</h3>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                              Pagina
                            </p>
                            <p className="mt-1 text-white">{event.page_type}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                              Entidad
                            </p>
                            <p className="mt-1 text-white">{event.entity_type || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                              ID
                            </p>
                            <p className="mt-1 break-all text-sm text-white">{event.entity_id || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                              Actor
                            </p>
                            <p className="mt-1 text-white">{actorLabel}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-right">
                        <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                          {new Date(event.created_at).toLocaleString("es-ES")}
                        </div>
                        <p className="text-xs text-[var(--text-soft)]">Sesion: {event.session_id}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                        Metadata
                      </p>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-white/80">
                        {formatMetadata(event.metadata)}
                      </pre>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">No hay eventos de analytics para este filtro.</p>
          </div>
        )}
      </section>
    </main>
  );
}
