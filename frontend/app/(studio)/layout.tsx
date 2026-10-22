import { StudioSidebar } from "@/components/studio/sidebar";
import { requireUser } from "@/lib/auth";
import { serverApiOrNull } from "@/lib/server";
import type { ConfigStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const config = await serverApiOrNull<ConfigStatus>("/api/config/status");

  return (
    <div className="min-h-screen bg-ivory lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <StudioSidebar user={user} aiConfigured={config?.ai.configured ?? false} />
      <div className="min-w-0">
        <main id="main" className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
