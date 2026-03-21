import type { ProductHealthSnapshot } from "@/lib/intelligence/product-health";

interface ProductHealthPanelProps {
  snapshot: ProductHealthSnapshot;
  audience: "seller" | "admin";
}

function formatCurrency(cents: number) {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export function ProductHealthPanel({ snapshot, audience }: ProductHealthPanelProps) {
  return (
    <section
      data-product-health-panel={audience}
      className="rounded-3xl border border-white/10 bg-white/5 p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
            {audience === "seller" ? "Seller intelligence" : "Admin intelligence"}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Lectura de salud del producto</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${snapshot.tone}`}>
              {snapshot.label}
            </span>
          </div>
          <p className="mt-4 text-sm text-[var(--text-soft)]">{snapshot.summary}</p>
          <p className="mt-3 text-sm text-white">
            Siguiente accion: <span className="font-semibold">{snapshot.nextAction}</span>
          </p>
        </div>

        <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Views 30d</p>
            <p className="mt-2 text-2xl font-bold text-white">{snapshot.metrics.views30d}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Compras 30d</p>
            <p className="mt-2 text-2xl font-bold text-white">{snapshot.metrics.purchases30d}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Conversion</p>
            <p className="mt-2 text-2xl font-bold text-white">{snapshot.metrics.conversionRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Ingresos 30d</p>
            <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(snapshot.metrics.revenue30dCents)}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.signals.map((signal) => (
          <div
            key={signal.label}
            data-product-health-signal={signal.label}
            className="rounded-2xl border border-white/10 bg-black/10 p-4"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">{signal.label}</p>
            <p className={`mt-2 text-xl font-semibold ${signal.tone}`}>{signal.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
