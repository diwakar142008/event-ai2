import Link from "next/link";
import type { ReactNode } from "react";

import { Mark } from "@/components/ui/logo";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="main" className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden overflow-hidden bg-burgundy px-12 py-10 text-ivory lg:flex lg:flex-col lg:justify-between">
        <div className="grain absolute inset-0" aria-hidden />
        <div className="relative z-10 flex items-center gap-2.5">
          <Mark className="h-7 w-7" />
          <span className="font-display text-[24px]">Eventora AI</span>
        </div>
        <div className="relative z-10 max-w-[24ch]">
          <p className="eyebrow text-[9px] text-champagne-soft">The editorial event atelier</p>
          <p className="mt-5 font-display text-[clamp(2.2rem,3.4vw,3.2rem)] leading-[1.02]">
            “The plan is a promise you can keep.”
          </p>
          <p className="mt-6 max-w-[32ch] text-[12.5px] leading-relaxed text-[#e7d9db]">
            Cost intelligence, a recommendation engine, budget-risk triage, and a schema-validated planning
            assistant — in one private workspace.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-4 border-t border-ivory/20 pt-5">
          {[
            ["Models", "03 trained"],
            ["Data", "Your events"],
            ["AI", "Optional"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-champagne-soft">{label}</p>
              <p className="mt-1 text-[12.5px]">{value}</p>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-h-screen flex-col px-5 py-7 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 lg:hidden">
            <Mark className="h-6 w-6" />
            <span className="font-display text-[21px]">Eventora AI</span>
          </Link>
          <Link href="/" className="ml-auto text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute hover:text-burgundy">
            Back to studio
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-10">
          <p className="eyebrow text-burgundy">{eyebrow}</p>
          <h1 className="display mt-3 text-[clamp(2.4rem,4.6vw,3.4rem)]">{title}</h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-[12.5px] text-ink-mute">{footer}</div> : null}
        </div>

        <p className="mx-auto w-full max-w-[430px] text-[10.5px] leading-relaxed text-ink-mute">
          Self-hosted session authentication with Argon2id hashing and HttpOnly cookies. Review the security
          notes before deploying with real accounts.
        </p>
      </section>
    </main>
  );
}
