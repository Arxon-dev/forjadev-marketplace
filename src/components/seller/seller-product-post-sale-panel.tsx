import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SellerPostSaleSnapshot } from "@/lib/seller/post-sale-visibility";

interface SellerProductPostSalePanelProps {
  productId: string;
  snapshot: SellerPostSaleSnapshot;
}

export function SellerProductPostSalePanel({
  productId,
  snapshot,
}: SellerProductPostSalePanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
            Post-sale continuity
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Salud postventa del producto</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            Lectura compacta de tickets, disputas, refunds, licencias revocadas y senales de riesgo
            para que no operes el producto a ciegas despues de la compra.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/seller/products/${productId}/support`}>
            <Button variant="secondary">Abrir soporte</Button>
          </Link>
          <Link href={`/seller/products/${productId}/edit`}>
            <Button variant="ghost">Revisar promesas del producto</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Esperando seller</p>
          <p className="mt-2 text-2xl font-bold text-white">{snapshot.metrics.waitingSellerTickets}</p>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-sky-200">Disputas activas</p>
          <p className="mt-2 text-2xl font-bold text-white">{snapshot.metrics.activeDisputes}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-200">Refunds emitidos</p>
          <p className="mt-2 text-2xl font-bold text-white">{snapshot.metrics.refundedOrders}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-200">Licencias revocadas</p>
          <p className="mt-2 text-2xl font-bold text-white">{snapshot.metrics.revokedLicenses}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Senales abiertas</p>
          <p className="mt-2 text-2xl font-bold text-white">{snapshot.metrics.openRiskSignals}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
            Siguiente accion
          </p>
          <p className="mt-3 text-base font-semibold text-white">{snapshot.nextAction}</p>
          <p className="mt-3 text-sm text-[var(--text-soft)]">{snapshot.trustSummary}</p>
          <p className="mt-3 text-xs text-[var(--text-soft)]">
            Esta vista resume senales operativas del producto y no expone evidencia privada del buyer.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Senales recientes
            </p>
            <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
              {snapshot.events.length} evento(s)
            </Badge>
          </div>

          {snapshot.events.length > 0 ? (
            <div className="mt-4 space-y-3">
              {snapshot.events.map((event) => (
                <article key={`${event.kind}-${event.id}`} className={`rounded-2xl border p-4 ${event.tone}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-white">{event.title}</p>
                    <p className="text-xs">
                      {new Date(event.at).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <p className="mt-2 text-sm">{event.summary}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-soft)]">
              No hay incidentes postventa recientes para este producto.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
