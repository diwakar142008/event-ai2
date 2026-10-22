import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col">
      <div className="shell flex h-[74px] items-center border-b border-line">
        <Logo />
      </div>
      <div className="shell flex flex-1 flex-col justify-center py-20">
        <p className="eyebrow text-burgundy">404 · Not in the atelier</p>
        <h1 className="display mt-4 max-w-[16ch] text-[clamp(3rem,8vw,6rem)]">
          This room is <span className="display-italic">unavailable.</span>
        </h1>
        <p className="mt-5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-soft">
          The page may not exist, or the event belongs to another account. Private records are never
          confirmed to unauthorised visitors.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn btn-primary">Back to workspace</Link>
          <Link href="/" className="btn btn-outline">Return to the studio</Link>
        </div>
      </div>
    </main>
  );
}
