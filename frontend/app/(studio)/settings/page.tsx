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
    <div className="settings-page">
      <PageHeader
        eyebrow="Settings"
        title={<>Your <span className="display-italic">settings.</span></>}
        description="Update your profile, export or remove your event data, and check how planning estimates are configured. Provider secrets are never shown here."
      />
      <SettingsClient user={user} config={config} aiStatus={aiStatus} metrics={metrics} />
    </div>
  );
}
