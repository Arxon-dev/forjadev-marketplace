import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface CommerceStageAction {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
}

interface CommerceStageStat {
  label: string;
  value: string;
}

interface CommerceStageProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: CommerceStageAction[];
  stats?: CommerceStageStat[];
  path?: ReactNode;
  align?: "left" | "split";
  surface?: "hero" | "context";
  dataId?: string;
}

interface CommerceSectionHeadingProps {
  eyebrow?: string;
  title: string;
  description: string;
  aside?: ReactNode;
  dataId?: string;
}

function actionClassName(variant: "primary" | "secondary") {
  if (variant === "secondary") {
    return "inline-flex rounded-2xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10";
  }

  return "inline-flex rounded-2xl bg-[linear-gradient(135deg,var(--primary),#1fd6c8)] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-95";
}

export function CommerceStage({
  eyebrow = "Marketplace",
  title,
  description,
  actions = [],
  stats = [],
  path = null,
  align = "left",
  surface = "hero",
  dataId = "stage",
}: CommerceStageProps) {
  const surfaceClassName =
    surface === "hero"
      ? "border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(39,197,180,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(67,132,255,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]"
      : "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]";

  return (
    <section
      className={`rounded-[2rem] border p-8 shadow-[0_24px_70px_rgba(2,8,23,0.28)] lg:p-10 ${surfaceClassName}`}
      data-commerce-stage={dataId}
    >
      {path ? <div className="mb-5">{path}</div> : null}

      <div className={align === "split" ? "grid gap-8 xl:grid-cols-[1.1fr_0.9fr]" : ""}>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-white md:text-5xl xl:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-soft)] md:text-lg">
            {description}
          </p>

          {actions.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {actions.map((action) => (
                <Link
                  key={`${action.href}:${action.label}`}
                  href={action.href}
                  className={actionClassName(action.variant || "primary")}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {stats.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {stats.map((stat) => (
              <div
                key={`${stat.label}:${stat.value}`}
                className="rounded-2xl border border-white/10 bg-black/15 p-4 backdrop-blur-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  {stat.label}
                </p>
                <p className="mt-3 text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function CommerceSectionHeading({
  eyebrow = "Shopping Journey",
  title,
  description,
  aside = null,
  dataId = "section",
}: CommerceSectionHeadingProps) {
  return (
    <div
      className="mb-8 flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-6 md:flex-row md:items-end md:justify-between"
      data-commerce-section={dataId}
    >
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-soft)] md:text-base">{description}</p>
      </div>
      {aside ? <div className="flex flex-wrap gap-2">{aside}</div> : null}
    </div>
  );
}

export function CommerceContextBadges({
  items,
}: {
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item}
          className="border-white/10 bg-black/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}
