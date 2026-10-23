import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, FileText, Plus, Sparkles } from "lucide-react";

import { BudgetChart } from "@/components/studio/budget-chart";
import { OccasionChart } from "@/components/studio/occasion-chart";
import { EmptyState, PageHeader, RiskBadge, Stat, TextLink } from "@/components/studio/ui";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatDate, daysUntil, money, titleCase } from "@/lib/format";
import { serverApiOrNull } from "@/lib/server";
import type { DashboardData } from "@/lib/types";

export const metadata: Metadata = { title: "Workspace", robots: { index: false } };

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await serverApiOrNull<DashboardData>("/api/dashboard");

  if (!data) {
    return (
      <>
        <PageHeader eyebrow="Workspace" title={<>The studio is <span className="display-italic">quiet.</span></>} />
        <div className="border border-line bg-[#fbf9f3] p-8">
          <h2 className="font-display text-[26px]">We could not reach the planning service.</h2>
          <p className="mt-2 max-w-[52ch] text-[13px] text-ink-soft">
            The workspace needs the API to load your events. Check that the FastAPI service is running, then
            refresh this page.
          </p>
        </div>
      </>
    );
  }

  const { stats } = data;
  const hasEvents = stats.event_count > 0;
  const totalRisk = data.risk_distribution.low + data.risk_distribution.medium + data.risk_distribution.high;
  const firstName = user.display_name.split(" ")[0];
  const occasions = [
    ["Weddings", "wedding"],
    ["Corporate", "corporate_event"],
    ["Engagements", "engagement"],
    ["Festivals", "college_festival"],
    ["Community", "community_celebration"],
    ["Birthdays", "birthday"],
  ];

  return (
    <>
      <div className="dashboard-reveal">
        <PageHeader
          eyebrow={`${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long" })} · Workspace`}
          title={
            <>
              {firstName}, the room is <span className="display-italic">yours.</span>
            </>
          }
          description="Your occasions, planning estimates, risks, and outstanding work — in one place."
          actions={
            <>
              <ButtonLink href="/events/new" size="sm">
                <Plus size={14} aria-hidden /> New event
              </ButtonLink>
              <ButtonLink href="/recommendations" variant="outline" size="sm">
                Recommendations
              </ButtonLink>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Upcoming"
          value={String(stats.upcoming_count)}
          hint={`${stats.event_count} total event${stats.event_count === 1 ? "" : "s"}`}
          accent
          emptyProgress={stats.event_count === 0 ? 0 : undefined}
          className="dashboard-stat dashboard-stagger-1"
        />
        <Stat label="Committed budget" value={money(stats.total_budget_cents, { compact: true })} hint="Sum of saved event budgets" className="dashboard-stat dashboard-stagger-2" />
        <Stat
          label="Expenses logged"
          value={money(stats.total_expenses_cents, { compact: true })}
          hint={
            stats.total_budget_cents > 0
              ? `${Math.round((stats.total_expenses_cents / stats.total_budget_cents) * 100)}% of committed budget`
              : "No budget committed yet"
          }
          className="dashboard-stat dashboard-stagger-3"
        />
        <Stat label="Open tasks" value={String(stats.tasks_open)} hint={`${stats.tasks_done} completed`} className="dashboard-stat dashboard-stagger-4" />
      </div>

      <div className="dashboard-sticky-action" role="region" aria-label="Quick action">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Keep planning</span>
        <ButtonLink href="/events/new" size="sm" className="dashboard-sticky-button">
          <Plus size={14} aria-hidden /> New event
        </ButtonLink>
      </div>

      {!hasEvents ? (
        <div className="mt-6">
          <section className="dashboard-occasion-banner dashboard-reveal dashboard-stagger-2" aria-label="Choose an event occasion">
            <div className="flex flex-col gap-2 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ivory">What are you planning?</p>
              <p className="text-[10px] text-ivory/90">Choose an occasion to start your brief</p>
            </div>
            <div className="dashboard-occasion-grid" role="group" aria-label="Start planning by occasion">
              {occasions.map(([label, type]) => (
                <Link className="dashboard-occasion-link" href={`/events/new?type=${type}`} key={type}>
                  <span>{label}</span>
                  <ArrowRight size={13} aria-hidden />
                </Link>
              ))}
            </div>
          </section>
          <div className="dashboard-empty-reveal">
            <EmptyState
              icon={<Sparkles size={22} aria-hidden />}
              title="Begin with a brief."
              body="Create your first event to unlock cost estimates, budget-risk triage, a generated plan, and the full workspace."
              action={
                <ButtonLink href="/events/new" size="sm" className="dashboard-cta">
                  Plan an event <ArrowRight size={14} aria-hidden />
                </ButtonLink>
              }
            />
          </div>
          <section className="mt-4 border border-line bg-[#fbf9f3]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="eyebrow text-[9px] text-ink-mute">Your workspace</p>
                <h2 className="mt-0.5 font-display text-[21px]">Occasion mix</h2>
              </div>
              <span className="text-[11px] text-ink-mute">0 events</span>
            </div>
            <div className="p-4">
              <OccasionChart data={data.occasion_distribution ?? []} />
            </div>
            <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-ink-mute">
              This chart counts your saved events by occasion. It updates as you add events.
            </p>
          </section>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div className="space-y-5">
            <section className="border border-line bg-[#fbf9f3]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Calendar</p>
                  <h2 className="mt-0.5 font-display text-[22px]">Upcoming events</h2>
                </div>
                <TextLink href="/events/new">Add one</TextLink>
              </div>
              {data.upcoming.length === 0 ? (
                <p className="px-4 py-8 text-[12.5px] text-ink-mute">No future-dated events yet.</p>
              ) : (
                <ul>
                  {data.upcoming.map((event) => {
                    const days = daysUntil(event.event_date);
                    return (
                      <li key={event.id} className="border-b border-line/70 last:border-0">
                        <Link href={`/events/${event.id}`} className="group grid gap-4 px-4 py-4 sm:grid-cols-[64px_1fr_auto] sm:items-center">
                          <div className="flex h-[62px] w-[58px] flex-col items-center justify-center border border-line bg-ivory">
                            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-burgundy">
                              {new Date(event.event_date).toLocaleDateString("en-GB", { month: "short" })}
                            </span>
                            <span className="font-display text-[26px] leading-none">
                              {new Date(event.event_date).toLocaleDateString("en-GB", { day: "2-digit" })}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-display text-[22px] leading-tight group-hover:text-burgundy">
                                {event.name}
                              </h3>
                              <RiskBadge level={event.risk_level} />
                            </div>
                            <p className="mt-1 text-[11.5px] text-ink-mute">
                              {titleCase(event.event_type)} · {event.city} · {event.guest_count} guests
                              {days >= 0 ? ` · ${days} days out` : ""}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-ink-soft">
                              <span>Budget {money(event.budget_cents)}</span>
                              <span className="text-line" aria-hidden>|</span>
                              <span>Estimate {money(event.predicted_cost_cents)}</span>
                            </div>
                          </div>
                          <ArrowRight size={16} aria-hidden className="hidden text-ink-mute transition-transform group-hover:translate-x-1 group-hover:text-burgundy sm:block" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="border border-line bg-[#fbf9f3]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Machine intelligence</p>
                  <h2 className="mt-0.5 font-display text-[22px]">Budget vs model estimate</h2>
                </div>
                <span className="label-chip text-[8.5px]">USD · planning</span>
              </div>
              <div className="p-3">
                <BudgetChart data={data.budget_chart} />
              </div>
              <p className="border-t border-line px-4 py-2.5 text-[10px] leading-relaxed text-ink-mute">
                Estimates come from a Random Forest trained on synthetic data. They are planning ranges, not quotes.
              </p>
            </section>

            <section className="border border-line bg-[#fbf9f3]">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Your events</p>
                  <h2 className="mt-0.5 font-display text-[22px]">Occasion mix</h2>
                </div>
                <span className="text-[11px] tabular-nums text-ink-mute">{stats.event_count} total</span>
              </div>
              <div className="p-4">
                <OccasionChart data={data.occasion_distribution ?? []} />
              </div>
              <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-ink-mute">
                The chart shows how your saved events are split by occasion. Hover over a segment for its count and share.
              </p>
            </section>
          </div>

          <div className="space-y-5">
            <section className="border border-line bg-[#fbf9f3] p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[21px]">Risk distribution</h2>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-mute">
                  {totalRisk} assessed
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { key: "low", label: "Low", color: "bg-[#7e9b78]" },
                  { key: "medium", label: "Medium", color: "bg-[#c8a75a]" },
                  { key: "high", label: "High", color: "bg-[#a95f57]" },
                  { key: "unassessed", label: "Unassessed", color: "bg-[#cfc7b8]" },
                ].map((row) => {
                  const count = data.risk_distribution[row.key as keyof typeof data.risk_distribution];
                  const share = stats.event_count ? Math.round((count / stats.event_count) * 100) : 0;
                  return (
                    <div key={row.key}>
                      <div className="flex justify-between text-[11px]">
                        <span>{row.label}</span>
                        <span className="tabular-nums text-ink-mute">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full bg-ivory-deep">
                        <div className={`h-full ${row.color}`} style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[10px] leading-relaxed text-ink-mute">
                Rule-derived triage, refreshed when an event is saved. Not a guarantee.
              </p>
            </section>

            <section className="border border-line bg-[#fbf9f3]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="font-display text-[21px]">Outstanding tasks</h2>
                <CheckCircle2 size={15} aria-hidden className="text-ink-mute" />
              </div>
              {data.tasks.length === 0 ? (
                <p className="px-4 py-6 text-[12px] text-ink-mute">
                  No open tasks. Generate a plan to seed the vendor checklist, then add your own.
                </p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {data.tasks.map((task) => (
                    <li key={task.id} className="px-4 py-3">
                      <Link href={`/events/${task.event_id}`} className="group block">
                        <p className="text-[12.5px] leading-snug group-hover:text-burgundy">{task.title}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-mute">
                          <CalendarDays size={11} aria-hidden />
                          {task.event_name} · {task.due_date ? `due ${formatDate(task.due_date, "short")}` : "no due date"}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border border-line bg-[#fbf9f3]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="font-display text-[21px]">Recent plans</h2>
                <FileText size={14} aria-hidden className="text-ink-mute" />
              </div>
              {data.recent_plans.length === 0 ? (
                <p className="px-4 py-6 text-[12px] text-ink-mute">No plans generated yet.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {data.recent_plans.map((plan) => (
                    <li key={plan.id} className="px-4 py-3">
                      <Link href={`/events/${plan.event_id}`} className="group flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[12.5px] group-hover:text-burgundy">{plan.event_name}</p>
                          <p className="mt-0.5 text-[10px] text-ink-mute">
                            {formatDate(plan.created_at, "short")} · {plan.engine === "ai" ? "AI generated" : "Deterministic"}
                          </p>
                        </div>
                        <ArrowRight size={13} aria-hidden className="text-ink-mute" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="border border-champagne bg-champagne-soft/40 p-4">
              <p className="eyebrow text-[9px] text-ink-mute">Quick action</p>
              <p className="mt-1.5 font-display text-[23px] leading-tight">Start another occasion.</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
                A new brief takes about two minutes and produces an instant planning estimate.
              </p>
              <ButtonLink href="/events/new" variant="outline" size="sm" className="mt-3">
                <Plus size={13} aria-hidden /> New event
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
