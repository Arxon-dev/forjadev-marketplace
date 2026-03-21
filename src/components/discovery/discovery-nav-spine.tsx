import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  CommerceContextBadges,
  CommercePanel,
} from "@/components/marketplace/commerce-surface-system";

interface DiscoveryNavLink {
  label: string;
  href: string;
  active?: boolean;
}

interface DiscoveryNavSpineProps {
  eyebrow?: string;
  title: string;
  description: string;
  path?: DiscoveryNavLink[];
  primaryLinks: DiscoveryNavLink[];
  categoryLinks?: DiscoveryNavLink[];
  gameLinks?: DiscoveryNavLink[];
}

function LinkGroup({
  title,
  links,
}: {
  title: string;
  links: DiscoveryNavLink[];
}) {
  if (links.length === 0) {
    return null;
  }

  return (
    <CommercePanel variant="soft" className="p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <Link key={`${title}:${link.href}:${link.label}`} href={link.href}>
            <Badge
              className={
                link.active
                  ? "cursor-pointer border-[var(--primary)]/30 bg-[var(--primary)]/15 text-white hover:opacity-95"
                  : "cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white"
              }
            >
              {link.label}
            </Badge>
          </Link>
        ))}
      </div>
    </CommercePanel>
  );
}

export function DiscoveryNavSpine({
  eyebrow = "Discovery Spine",
  title,
  description,
  path = [],
  primaryLinks,
  categoryLinks = [],
  gameLinks = [],
}: DiscoveryNavSpineProps) {
  return (
    <section
      className="rounded-[2.15rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(67,132,255,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(39,197,180,0.12),transparent_20%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.028))] p-6 shadow-[0_22px_55px_rgba(2,8,23,0.24)]"
      data-discovery-spine="marketplace"
    >
      {path.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
          {path.map((item, index) => (
            <div key={`${item.href}:${item.label}`} className="flex items-center gap-3">
              {index > 0 ? <span>/</span> : null}
              {item.active ? (
                <span className="text-white">{item.label}</span>
              ) : (
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <p className="inline-flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
        <span className="h-px w-8 bg-[var(--primary)]/60" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold text-white">{title}</h2>
      <p className="mt-3 max-w-3xl text-[var(--text-soft)]">{description}</p>
      <div className="mt-5">
        <CommerceContextBadges
          items={[
            "Discovery coherente",
            "Browse con contexto",
            "Ruta estable a producto",
          ]}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <LinkGroup title="Rutas clave" links={primaryLinks} />
        <LinkGroup title="Explorar por categoria" links={categoryLinks} />
        <LinkGroup title="Explorar por juego" links={gameLinks} />
      </div>
    </section>
  );
}
