import { AlertTriangle, ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col justify-between gap-5 border-b border-line pb-6 md:flex-row md:items-end">
      <div>
        <p className="eyebrow text-burgundy">{eyebrow}</p>
        <h1 className="display mt-2.5 text-[clamp(2.2rem,4vw,3.6rem)]">{title}</h1>
        {description ? <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent = false,
  className = "",
  emptyProgress,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  className?: string;
  emptyProgress?: number;
}) {
  return (
    <div className={`border p-4 ${accent ? "border-ink bg-ink text-ivory dashboard-stat-accent" : "border-line bg-[#fbf9f3]"} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[9px] font-bold uppercase tracking-[0.16em] ${accent ? "text-champagne" : "text-ink-mute"}`}>
            {label}
          </p>
          <p className="mt-2 font-display text-[30px] leading-none">{value}</p>
        </div>
        {emptyProgress !== undefined ? (
          <div className="relative grid h-11 w-11 shrink-0 place-items-center" role="img" aria-label={`Workspace setup ${emptyProgress}% complete; create your first event to finish setup`}>
            <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(255 250 240 / 25%)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16" fill="none" stroke="#d6bd7c" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(Math.max(0, Math.min(100, emptyProgress)) / 100) * 100.53} 100.53`}
              />
            </svg>
            <span className="text-[9px] font-bold text-champagne">{emptyProgress}%</span>
          </div>
        ) : null}
      </div>
      {hint ? (
        <p className={`mt-2 text-[10.5px] leading-relaxed ${accent ? "text-[#b9b3a4]" : "text-ink-mute"}`}>{hint}</p>
      ) : null}
    </div>
  );
}

export function RiskBadge({ level }: { level: string | null | undefined }) {
  const map: Record<string, string> = {
    low: "border-[#9db59a] bg-[#e7eee2] text-[#3c5a36]",
    medium: "border-[#d9c58f] bg-[#f6eed7] text-[#715620]",
    high: "border-[#d3a09c] bg-[#f6e4e1] text-[#7c2f2a]",
  };
  const label = level ? `${level} budget risk` : "unassessed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] ${
        map[level ?? ""] ?? "border-line bg-ivory-deep text-ink-mute"
      }`}
    >
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export function EngineBadge({ engine, model }: { engine: string; model?: string }) {
  const ai = engine === "ai";
  return (
    <span
      className={`label-chip ${ai ? "border-sage bg-sage-soft/60 text-[#3f523a]" : "border-line bg-ivory-deep text-ink-soft"}`}
      title={model}
    >
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden />
      {ai ? "AI generated" : "Deterministic fallback"}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center border border-dashed border-line px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-ink-mute">{icon}</div> : null}
      <h3 className="font-display text-[24px]">{title}</h3>
      <p className="mt-2 max-w-[42ch] text-[12.5px] leading-relaxed text-ink-mute">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-ink-mute">
      <Loader2 size={14} className="animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 border-l-2 border-danger bg-[#f6e9e6] px-3 py-2 text-[12.5px] text-danger">
      <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-line bg-[#fbf9f3] ${className}`}>
      {title || eyebrow ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            {eyebrow ? <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">{eyebrow}</p> : null}
            {title ? <h2 className="mt-0.5 font-display text-[21px] leading-tight">{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-burgundy hover:underline">
      {children} <ArrowUpRight size={12} aria-hidden />
    </Link>
  );
}
