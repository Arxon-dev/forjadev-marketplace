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

interface CommercePanelProps {
  children: ReactNode;
  variant?: "stage" | "section" | "tile" | "soft";
  className?: string;
  dataId?: string;
  sectionDataId?: string;
}

function joinClassNames(...classNames: Array<string | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function actionClassName(variant: "primary" | "secondary") {
  if (variant === "secondary") {
    return "inline-flex min-h-11 items-center rounded-full border border-[var(--border-strong)] bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(2,8,23,0.16)] transition hover:border-white/30 hover:bg-white/[0.1]";
  }

  return "inline-flex min-h-11 items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--teal))] px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_18px_38px_rgba(31,214,200,0.22)] transition hover:translate-y-[-1px] hover:opacity-95";
}

export function commercePanelClassName(variant: "stage" | "section" | "tile" | "soft" = "section") {
  if (variant === "stage") {
    return "relative rounded-[2.35rem] border border-[var(--border-strong)] bg-[radial-gradient(circle_at_top_left,rgba(31,214,200,0.2),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(91,140,255,0.22),transparent_30%),linear-gradient(160deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03)_48%,rgba(9,14,28,0.58))] shadow-[var(--shadow-stage)]";
  }

  if (variant === "tile") {
    return "relative rounded-[1.9rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(18,27,46,0.82)_42%,rgba(10,16,31,0.96))] shadow-[var(--shadow-panel)]";
  }

  if (variant === "soft") {
    return "relative rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(11,16,32,0.68))] shadow-[0_16px_34px_rgba(2,8,23,0.18)]";
  }

  return "relative rounded-[1.95rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(16,24,43,0.8)_55%,rgba(10,16,31,0.95))] shadow-[0_22px_55px_rgba(2,8,23,0.24)]";
}

export function CommercePanel({
  children,
  variant = "section",
  className,
  dataId = "panel",
  sectionDataId,
}: CommercePanelProps) {
  return (
    <div
      className={joinClassNames(commercePanelClassName(variant), "overflow-hidden", className)}
      data-commerce-panel={dataId}
      data-commerce-section={sectionDataId}
    >
      {children}
    </div>
  );
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
  const panelClassName =
    surface === "hero"
      ? commercePanelClassName("stage")
      : commercePanelClassName("section");

  return (
    <section
      className={joinClassNames(panelClassName, "overflow-hidden p-8 lg:p-10")}
      data-commerce-stage={dataId}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%,rgba(11,16,32,0.28))]" />
      {path ? <div className="mb-5">{path}</div> : null}

      <div className={align === "split" ? "grid gap-8 xl:grid-cols-[1.1fr_0.9fr]" : ""}>
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            <span className="h-px w-8 bg-[var(--primary)]/70" />
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
              <CommercePanel
                key={`${stat.label}:${stat.value}`}
                variant="soft"
                className="p-4 backdrop-blur-sm"
                dataId={`stage-stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  {stat.label}
                </p>
                <p className="mt-3 text-2xl font-bold text-white">{stat.value}</p>
              </CommercePanel>
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
    <CommercePanel
      variant="section"
      className="mb-8 flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between"
      sectionDataId={dataId}
    >
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          <span className="h-px w-6 bg-[var(--primary)]/70" />
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-soft)] md:text-base">{description}</p>
      </div>
      {aside ? <div className="flex flex-wrap gap-2">{aside}</div> : null}
    </CommercePanel>
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
          className="border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(2,8,23,0.14)]"
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}
