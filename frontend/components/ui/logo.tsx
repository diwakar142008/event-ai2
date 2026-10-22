import Link from "next/link";

export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className} fill="none">
      <path
        d="M16 3v26M5.5 9.5l21 13M26.5 9.5l-21 13M16 3l-2.6 4.5M16 3l2.6 4.5M16 29l-2.6-4.5M16 29l2.6-4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Eventora AI home"
      className={`group inline-flex items-center gap-2.5 ${tone === "light" ? "text-ivory" : "text-ink"}`}
    >
      <Mark className="h-7 w-7 transition-transform duration-500 group-hover:rotate-45" />
      <span className="flex items-baseline gap-1.5">
        <span className="font-display text-[22px] leading-none tracking-[-0.03em]">Eventora</span>
        {!compact && (
          <span className="eyebrow text-[9px] tracking-[0.18em] opacity-70">AI</span>
        )}
      </span>
    </Link>
  );
}
