import type { Metadata } from "next";

import { SettingsClient } from "@/components/studio/settings-client";
import { PageHeader } from "@/components/studio/ui";
import { requireUser } from "@/lib/auth";
import { serverApiOrNull } from "@/lib/server";
import type { AIStatus, ConfigStatus, MLMetrics } from "@/lib/types";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const user = await requireUser();
  const [config, aiStatus, metrics] = await Promise.all([
    serverApiOrNull<ConfigStatus>("/api/config/status"),
    serverApiOrNull<AIStatus>("/api/ai/status"),
    serverApiOrNull<MLMetrics>("/api/ml/metrics"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title={<>The <span className="display-italic">fine print.</span></>}
        description="Account, privacy controls, data deletion, and configuration status. No secret values are displayed on this page."
      />
      <SettingsClient user={user} config={config} aiStatus={aiStatus} metrics={metrics} />
    </>
  );
}
