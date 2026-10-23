import Link from "next/link";
import type { ReactNode } from "react";
import Image from "next/image";

import { Mark } from "@/components/ui/logo";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  mode,
  children,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  mode: "sign-in" | "sign-up";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const returning = mode === "sign-in";

  return (
    <main id="main" className="auth-layout">
      <aside className="auth-visual">
        <Image
          src="/images/wedding.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 48vw, 100vw"
          className="auth-visual-image"
        />
        <div className="auth-visual-overlay" aria-hidden="true" />
        <Link href="/" className="auth-brand">
          <Mark className="h-7 w-7" />
          <span>Eventora <i>AI</i></span>
        </Link>
        <div className="auth-visual-copy">
          <p className="auth-eyebrow">The celebration, thoughtfully planned</p>
          <h2>{returning ? "A little more room for the moments that matter." : "Give your next celebration a beautiful beginning."}</h2>
          <p>
            Bring the details, decisions, and people together in one calm planning space.
            Your ideas stay yours; the tools help you move them forward.
          </p>
          <ul>
            {(returning
              ? ["Pick up where your plans left off", "Keep every event in one private space", "Make the next decision with clarity"]
              : ["Start with a brief that feels like you", "Turn ideas into an editable event plan", "Keep timelines and budgets close at hand"]
            ).map((item, index) => (
              <li key={item}>
                <span>0{index + 1}</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-visual-caption">PLAN WITH INTENTION <span>·</span> CELEBRATE WITH EASE</p>
      </aside>

      <section className="auth-main">
        <header className="auth-topbar">
          <Link href="/" className="auth-mobile-brand">
            <Mark className="h-6 w-6" />
            <span>Eventora <i>AI</i></span>
          </Link>
          <span className="auth-topbar-note">{returning ? "YOUR PRIVATE EVENT SPACE" : "A PRIVATE SPACE TO BEGIN"}</span>
          <Link href="/" className="auth-back-link">Back to Eventora <span aria-hidden="true">↗</span></Link>
        </header>

        <div className="auth-content">
          <div className="auth-heading">
            <span className="auth-step-badge">{returning ? "WELCOME BACK" : "YOUR WORKSPACE, YOUR WAY"}</span>
            <p className="eyebrow text-burgundy">{eyebrow}</p>
            <h1 className="display">{title}</h1>
            <p className="auth-subtitle">{subtitle}</p>
          </div>
          <div className="auth-form-card">{children}</div>
          {footer ? <div className="auth-footer">{footer}</div> : null}
          <p className="auth-privacy-note">
            <span aria-hidden="true">✦</span>
            Your event details stay in your private workspace.
          </p>
        </div>

        <p className="auth-legal">Secure account access <span>·</span> Eventora AI</p>
      </section>
    </main>
  );
}
