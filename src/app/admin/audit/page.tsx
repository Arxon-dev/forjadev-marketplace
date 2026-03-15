import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Json | null;
  created_at: string;
};

type ProfileLookupRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
};

interface AdminAuditPageProps {
  searchParams?: Promise<{
    entity?: string;
  }>;
}

function formatMetadata(metadata: Json | null) {
  if (!metadata) {
    return "Sin metadata";
  }

  return JSON.stringify(metadata, null, 2);
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  await requireAdminContext();
  const adminSupabase = createAdminClient();
  const params = (await searchParams) || {};
  const selectedEntity = params.entity || "all";

  let auditQuery = (adminSupabase
    .from("audit_logs")
    .select("id, actor_user_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(100)) as any;

  if (selectedEntity !== "all") {
    auditQuery = auditQuery.eq("entity_type", selectedEntity);
  }

  const { data: logs } = (await auditQuery) as { data: AuditLogRow[] | null };
  const { data: allLogs } = (await adminSupabase
    .from("audit_logs")
    .select("entity_type")) as { data: Array<{ entity_type: string }> | null };

  const actorIds = Array.from(
    new Set((logs || []).map((log) => log.actor_user_id).filter(Boolean))
  ) as string[];

  const { data: profiles } = (actorIds.length
    ? await adminSupabase
        .from("profiles")
        .select("id, email, username, display_name")
        .in("id", actorIds)
    : { data: [] as ProfileLookupRow[] }) as { data: ProfileLookupRow[] | null };

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const counts = {
    product: (allLogs || []).filter((log) => log.entity_type === "product").length,
    license: (allLogs || []).filter((log) => log.entity_type === "license").length,
    order: (allLogs || []).filter((log) => log.entity_type === "order").length,
  };

  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Admin</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Auditoria operativa</h1>
            <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
              Consulta los eventos criticos mas recientes del marketplace: moderacion, licencias,
              compras y descargas trazables desde un unico panel.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="secondary">Volver a admin</Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Eventos de producto</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.product}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Eventos de licencia</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.license}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Eventos de orden</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.order}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/audit">
            <Button variant={selectedEntity === "all" ? "primary" : "secondary"}>Todo</Button>
          </Link>
          <Link href="/admin/audit?entity=product">
            <Button variant={selectedEntity === "product" ? "primary" : "secondary"}>
              Productos
            </Button>
          </Link>
          <Link href="/admin/audit?entity=license">
            <Button variant={selectedEntity === "license" ? "primary" : "secondary"}>
              Licencias
            </Button>
          </Link>
          <Link href="/admin/audit?entity=order">
            <Button variant={selectedEntity === "order" ? "primary" : "secondary"}>
              Ordenes
            </Button>
          </Link>
        </div>

        {logs && logs.length > 0 ? (
          <div className="mt-8 space-y-4">
            {logs.map((log) => {
              const actor = log.actor_user_id ? profileById.get(log.actor_user_id) : null;
              const actorLabel =
                actor?.display_name || actor?.username || actor?.email || log.actor_user_id || "Sistema";

              return (
                <article
                  key={log.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-[var(--text-soft)]">Accion</p>
                        <h2 className="text-lg font-semibold text-white">{log.action}</h2>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                            Entidad
                          </p>
                          <p className="mt-1 text-white">{log.entity_type}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                            ID
                          </p>
                          <p className="mt-1 break-all text-sm text-white">{log.entity_id}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                            Actor
                          </p>
                          <p className="mt-1 text-white">{actorLabel}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                      {new Date(log.created_at).toLocaleString("es-ES")}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                      Metadata
                    </p>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-white/80">
                      {formatMetadata(log.metadata)}
                    </pre>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">No hay eventos para este filtro.</p>
          </div>
        )}
      </section>
    </main>
  );
}
