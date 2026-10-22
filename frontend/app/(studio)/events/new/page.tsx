import type { Metadata } from "next";

import { EventWizard } from "@/components/studio/event-wizard";
import { PageHeader } from "@/components/studio/ui";

export const metadata: Metadata = { title: "Plan an event", robots: { index: false } };

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const eventType = type ?? "wedding";
  return (
    <div className="event-planning-page">
      <PageHeader
        eyebrow="New brief"
        title={<>Set the <span className="display-italic">scene.</span></>}
        description="Add the event basics, choose a style, then review a planning estimate. You can edit everything before saving."
      />
      <EventWizard initialEventType={eventType} />
    </div>
  );
}
