import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventWorkspace } from "@/components/studio/event-workspace";
import { serverApiOrNull } from "@/lib/server";
import type { EventRecord, ExpenseRecord, NoteRecord, PlanRecord, TaskRecord } from "@/lib/types";

export const metadata: Metadata = { title: "Event workspace", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generate?: string }>;
}) {
  const { id } = await params;
  const { generate } = await searchParams;
  const encoded = encodeURIComponent(id);

  const event = await serverApiOrNull<EventRecord>(`/api/events/${encoded}`);
  if (!event) notFound();

  const [planResponse, tasks, expenses, notes] = await Promise.all([
    serverApiOrNull<{ plan: PlanRecord | null }>(`/api/events/${encoded}/plan`),
    serverApiOrNull<TaskRecord[]>(`/api/events/${encoded}/tasks`),
    serverApiOrNull<ExpenseRecord[]>(`/api/events/${encoded}/expenses`),
    serverApiOrNull<NoteRecord[]>(`/api/events/${encoded}/notes`),
  ]);

  return (
    <EventWorkspace
      initialEvent={event}
      initialPlan={planResponse?.plan ?? null}
      initialTasks={tasks ?? []}
      initialExpenses={expenses ?? []}
      initialNotes={notes ?? []}
      generateOnLoad={generate === "1"}
    />
  );
}
