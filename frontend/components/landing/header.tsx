"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/ui/logo";

const links = [
  { href: "#categories", label: "Occasions" },
  { href: "#process", label: "Process" },
  { href: "#intelligence", label: "Intelligence" },
  { href: "#assistant", label: "Assistant" },
  { href: "#privacy", label: "Privacy" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/90 backdrop-blur-md">
      <div className="shell flex h-[74px] items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-burgundy"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/sign-in" className="text-[12px] font-semibold uppercase tracking-[0.14em] hover:text-burgundy">
            Sign in
          </Link>
          <Link href="/events/new" className="btn btn-primary min-h-[42px] px-5 text-[11px]">
            Plan an event
          </Link>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center border border-line lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
        </button>
      </div>
      {open ? (
        <div id="mobile-nav" className="border-t border-line bg-ivory px-5 pb-6 pt-2 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/60 py-3 text-sm font-semibold uppercase tracking-[0.12em]"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-5 flex flex-col gap-3">
              <Link href="/sign-in" onClick={() => setOpen(false)} className="btn btn-outline">
                Sign in
              </Link>
              <Link href="/events/new" onClick={() => setOpen(false)} className="btn btn-primary">
                Plan an event
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
