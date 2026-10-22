"use client";

import { LayoutGrid, LogOut, Menu, Plus, Settings2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/ui/logo";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";
import { initials } from "@/lib/format";

const nav = [
  { href: "/dashboard", label: "Workspace", icon: LayoutGrid },
  { href: "/events/new", label: "New event", icon: Plus },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function StudioSidebar({ user, aiConfigured }: { user: User; aiConfigured: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/auth/signout", { method: "POST" });
    } catch {
      // Even if the network fails, navigate away; the session expires server-side.
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-[74px] items-center justify-between border-b border-line px-5">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="lg:hidden"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      <nav aria-label="Studio" className="flex-1 px-3 py-6">
        <p className="eyebrow px-2 text-[8.5px] text-ink-mute">Studio</p>
        <ul className="mt-3 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 border-l-2 px-3 py-2.5 text-[12.5px] transition-colors ${
                    active
                      ? "border-burgundy bg-ivory-deep/70 font-semibold text-ink"
                      : "border-transparent text-ink-soft hover:border-line hover:bg-ivory-deep/40"
                  }`}
                >
                  <item.icon size={15} aria-hidden className={active ? "text-burgundy" : "text-ink-mute"} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-2 mt-8 border-t border-line pt-4">
          <p className="eyebrow text-[8.5px] text-ink-mute">Intelligence</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${aiConfigured ? "bg-sage" : "bg-champagne"}`} />
            <p className="text-[11.5px] text-ink-soft">
              {aiConfigured ? "AI provider configured" : "Deterministic fallback"}
            </p>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-mute">
            {aiConfigured
              ? "Plans use your configured provider."
              : "Plans are generated locally until a provider key is set."}
          </p>
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-line bg-ivory-deep text-[10.5px] font-bold">
            {initials(user.display_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold">{user.display_name}</p>
            <p className="truncate text-[10.5px] text-ink-mute">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="mt-1 flex w-full items-center gap-2 px-2 py-2 text-[11.5px] text-ink-mute transition-colors hover:text-burgundy disabled:opacity-50"
        >
          <LogOut size={13} aria-hidden />
          {signingOut ? "Signing out" : "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-[#f4f0e7] lg:block">{content}</aside>

      <div className="sticky top-0 z-40 flex h-[62px] items-center justify-between border-b border-line bg-ivory/95 px-5 backdrop-blur lg:hidden">
        <Logo compact />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center border border-line"
          aria-expanded={open}
          aria-controls="studio-mobile-nav"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            id="studio-mobile-nav"
            className="absolute inset-y-0 left-0 w-[84%] max-w-[320px] border-r border-line bg-[#f4f0e7]"
          >
            {content}
          </div>
        </div>
      ) : null}
    </>
  );
}
