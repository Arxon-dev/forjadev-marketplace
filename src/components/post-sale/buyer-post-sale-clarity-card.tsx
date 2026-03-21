import { type BuyerPostSaleTransparencySnapshot } from "@/lib/post-sale/buyer-transparency";

interface BuyerPostSaleClarityCardProps {
  snapshot: BuyerPostSaleTransparencySnapshot;
  compact?: boolean;
  title?: string;
}

export function BuyerPostSaleClarityCard({
  snapshot,
  compact = false,
  title = "Estado postventa claro",
}: BuyerPostSaleClarityCardProps) {
  return (
    <div
      data-postsale-clarity="buyer"
      data-postsale-stage={snapshot.stage}
      data-postsale-mode={compact ? "compact" : "full"}
      className={`rounded-2xl border p-4 ${snapshot.tone}`}
    >
      <p className="text-xs uppercase tracking-[0.16em]">{title}</p>
      <p className="mt-3 text-base font-semibold text-white">{snapshot.label}</p>
      <p className="mt-3 text-sm leading-6">{snapshot.summary}</p>
      <p className="mt-3 text-sm text-white">Siguiente paso: {snapshot.nextAction}</p>
      {!compact ? (
        <>
          <p className="mt-3 text-sm">Que puedes esperar: {snapshot.expectation}</p>
          <p className="mt-3 text-xs text-[var(--text-soft)]">{snapshot.policyHint}</p>
        </>
      ) : null}
    </div>
  );
}
