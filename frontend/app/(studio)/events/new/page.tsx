import type { Metadata } from "next";

import { EventWizard } from "@/components/studio/event-wizard";
import { PageHeader } from "@/components/studio/ui";

export const metadata: Metadata = { title: "Plan an event", robots: { index: false } };

export default function NewEventPage() {
  return (
    <>
      <PageHeader
        eyebrow="New brief"
        title={<>Set the <span className="display-italic">scene.</span></>}
        description="Three steps: the occasion, the direction, then a review with a real cost estimate before anything is saved."
      />
      <EventWizard />
    </>
  );
}
