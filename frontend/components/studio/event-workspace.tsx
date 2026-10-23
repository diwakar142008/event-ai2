"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  Download,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageSquare,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AssistantPanel } from "@/components/studio/assistant-panel";
import { BriefEditor } from "@/components/studio/brief-editor";
import { EngineBadge, EmptyState, InlineError, Panel, RiskBadge } from "@/components/studio/ui";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client";
import { formatDate, formatDateTime, money, percent, titleCase } from "@/lib/format";
import { CATERING_LEVELS, EVENT_TYPES, THEMES, VENUE_TYPES, labelFor } from "@/lib/options";
import type {
  BudgetRisk,
  EventRecord,
  ExpenseRecord,
  NoteRecord,
  PlanRecord,
  RecommendationItem,
  ScheduleItem,
  TaskRecord,
} from "@/lib/types";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "plan", label: "Plan", icon: Sparkles },
  { key: "reception", label: "Reception", icon: CalendarDays },
  { key: "timeline", label: "Timeline", icon: CalendarDays },
  { key: "checklist", label: "Checklist", icon: ListChecks },
  { key: "budget", label: "Budget", icon: Wallet },
  { key: "notes", label: "Notes", icon: NotebookPen },
  { key: "assistant", label: "Assistant", icon: MessageSquare },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const RECEPTION_CHECKLIST = [
  "Confirm reception venue access and room layout",
  "Approve table plan and guest seating",
  "Confirm final guest count and dietary requirements",
  "Confirm menu, drinks, and service timing",
  "Share speeches and key moments with the host",
  "Confirm music, sound check, and first dance",
  "Coordinate vendor arrival and setup times",
  "Prepare a day-of contact sheet and emergency kit",
];

function EventFlowchart({ items }: { items: ScheduleItem[] }) {
  return (
    <>
      <p className="mb-4 text-[11.5px] leading-relaxed text-ink-mute">
        Follow the event in order. A responsible person is shown when one is assigned.
      </p>
      <ol aria-label="Event-day flow" className="space-y-0">
        {items.map((item, index) => (
          <li key={`${item.time}-${index}`} className="grid grid-cols-[54px_20px_1fr] gap-2.5">
            <time className="pt-3 font-mono text-[11px] font-semibold text-burgundy">{item.time}</time>
            <span className="relative flex justify-center" aria-hidden>
              {index < items.length - 1 ? (
                <>
                  <span className="absolute top-5 bottom-0 w-px bg-champagne" />
                  <ArrowDown size={12} className="absolute bottom-0 z-10 bg-[#fbf9f3] text-burgundy" />
                </>
              ) : null}
              <span className="z-10 mt-3 h-3 w-3 rounded-full border-2 border-burgundy bg-[#fbf9f3]" />
            </span>
            <article className="mb-3 border border-line bg-[#fbf9f3] px-3 py-2.5">
              <h3 className="text-[12.5px] font-semibold leading-snug text-ink">{item.activity}</h3>
              {item.owner ? <p className="mt-1 text-[10px] text-ink-mute">Lead: {item.owner}</p> : null}
            </article>
          </li>
        ))}
      </ol>
    </>
  );
}

export function EventWorkspace({
  initialEvent,
  initialPlan,
  initialTasks,
  initialExpenses,
  initialNotes,
  generateOnLoad,
}: {
  initialEvent: EventRecord;
  initialPlan: PlanRecord | null;
  initialTasks: TaskRecord[];
  initialExpenses: ExpenseRecord[];
  initialNotes: NoteRecord[];
  generateOnLoad: boolean;
}) {
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);
  const [planRecord, setPlanRecord] = useState<PlanRecord | null>(initialPlan);
  const [tasks, setTasks] = useState(initialTasks);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [notes, setNotes] = useState(initialNotes);
  const [tab, setTab] = useState<TabKey>("overview");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [riskInfo, setRiskInfo] = useState<BudgetRisk | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const autoRan = useRef(false);

  const plan = planRecord?.plan ?? null;
  const spent = expenses.reduce((total, expense) => total + expense.amount_cents, 0);
  const paid = expenses.filter((expense) => expense.paid).reduce((total, expense) => total + expense.amount_cents, 0);
  const done = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? done / tasks.length : 0;
  const coverage = event.predicted_cost_cents ? event.budget_cents / event.predicted_cost_cents : null;

  const refreshTasks = useCallback(async () => {
    try {
      const fresh = await api<TaskRecord[]>(`/events/${event.id}/tasks`);
      setTasks(fresh);
    } catch {
      /* keep the current list */
    }
  }, [event.id]);

  const generate = useCallback(
    async (revisionNotes = "") => {
      setBusy("generate");
      setError(null);
      setNotice(null);
      try {
        const result = await api<PlanRecord>("/ai/generate-plan", {
          method: "POST",
          body: { event_id: event.id, focus: "", revision_notes: revisionNotes },
        });
        setPlanRecord(result);
        setNotice(
          result.engine === "ai"
            ? "Plan generated by the configured AI provider and validated against the schema."
            : "Plan generated by the deterministic fallback planner (no AI provider configured).",
        );
        await refreshTasks();
        try {
          const fresh = await api<EventRecord>(`/events/${event.id}`);
          setEvent(fresh);
        } catch {
          /* event refresh is best-effort */
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Plan generation failed. Please retry.");
      } finally {
        setBusy(null);
      }
    },
    [event.id, refreshTasks],
  );

  useEffect(() => {
    if (generateOnLoad && !initialPlan && !autoRan.current) {
      autoRan.current = true;
      void generate();
      router.replace(`/events/${event.id}`);
    }
  }, [generateOnLoad, generate, initialPlan, router, event.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadSignals() {
      if (event.predicted_cost_cents) {
        try {
          const risk = await api<BudgetRisk>("/ml/budget-risk", {
            method: "POST",
            body: {
              event_type: event.event_type,
              guest_count: event.guest_count,
              budget_cents: event.budget_cents,
              predicted_cost_cents: event.predicted_cost_cents,
              contingency_pct: 8,
            },
          });
          if (!cancelled) setRiskInfo(risk);
        } catch {
          if (!cancelled) setRiskInfo(null);
        }
      }
      try {
        const recs = await api<{ items: RecommendationItem[] }>("/ml/recommend", {
          method: "POST",
          body: {
            event_type: event.event_type,
            guest_count: event.guest_count,
            budget_cents: event.budget_cents,
            style: event.theme,
            venue_type: event.venue_type,
            limit: 6,
          },
        });
        if (!cancelled) setRecommendations(recs.items);
      } catch {
        if (!cancelled) setRecommendations([]);
      }
    }
    void loadSignals();
    return () => {
      cancelled = true;
    };
  }, [event.id, event.event_type, event.guest_count, event.budget_cents, event.theme, event.venue_type, event.predicted_cost_cents]);

  async function toggleTask(task: TaskRecord) {
    setBusy(`task-${task.id}`);
    setError(null);
    try {
      const updated = await api<TaskRecord>(`/events/${event.id}/tasks/${task.id}`, {
        method: "PATCH",
        body: { done: !task.done },
      });
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The task could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteTask(taskId: string) {
    setBusy(`delete-task-${taskId}`);
    try {
      await api(`/events/${event.id}/tasks/${taskId}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== taskId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The task could not be deleted.");
    } finally {
      setBusy(null);
    }
  }

  async function addTask(title: string, category: string, dueDate: string) {
    if (title.trim().length < 2) return;
    setBusy("add-task");
    try {
      const created = await api<TaskRecord>(`/events/${event.id}/tasks`, {
        method: "POST",
        body: { title: title.trim(), category, due_date: dueDate || null },
      });
      setTasks((current) => [...current, created]);
      setNotice("Task added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The task could not be added.");
    } finally {
      setBusy(null);
    }
  }

  async function addReceptionChecklist() {
    const existingTitles = new Set(tasks.map((task) => task.title.toLocaleLowerCase()));
    const missingItems = RECEPTION_CHECKLIST.filter((title) => !existingTitles.has(title.toLocaleLowerCase()));
    if (!missingItems.length) {
      setNotice("Your reception checklist is already up to date.");
      return;
    }

    setBusy("reception-checklist");
    setError(null);
    let added = 0;
    try {
      for (const title of missingItems) {
        const created = await api<TaskRecord>(`/events/${event.id}/tasks`, {
          method: "POST",
          body: { title, category: "reception", due_date: null },
        });
        setTasks((current) => [...current, created]);
        added += 1;
      }
      setNotice(`${added} reception ${added === 1 ? "task" : "tasks"} added to your checklist.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The reception checklist could not be added completely.");
    } finally {
      setBusy(null);
    }
  }

  async function addExpense(label: string, category: string, amount: string, paidNow: boolean) {
    const cents = Math.round(Number(amount) * 100);
    if (label.trim().length < 2 || !Number.isFinite(cents) || cents < 1) return;
    setBusy("add-expense");
    try {
      const created = await api<ExpenseRecord>(`/events/${event.id}/expenses`, {
        method: "POST",
        body: { label: label.trim(), category, amount_cents: cents, paid: paidNow },
      });
      setExpenses((current) => [created, ...current]);
      setNotice("Expense logged.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The expense could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleExpense(expense: ExpenseRecord) {
    setBusy(`expense-${expense.id}`);
    try {
      const updated = await api<ExpenseRecord>(`/events/${event.id}/expenses/${expense.id}`, {
        method: "PATCH",
        body: { paid: !expense.paid },
      });
      setExpenses((current) => current.map((item) => (item.id === expense.id ? updated : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The expense could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteExpense(expenseId: string) {
    setBusy(`delete-expense-${expenseId}`);
    try {
      await api(`/events/${event.id}/expenses/${expenseId}`, { method: "DELETE" });
      setExpenses((current) => current.filter((item) => item.id !== expenseId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The expense could not be deleted.");
    } finally {
      setBusy(null);
    }
  }

  async function addNote(body: string) {
    if (!body.trim()) return;
    setBusy("add-note");
    try {
      const created = await api<NoteRecord>(`/events/${event.id}/notes`, { method: "POST", body: { body: body.trim() } });
      setNotes((current) => [created, ...current]);
      setNotice("Note saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The note could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteNote(noteId: string) {
    setBusy(`delete-note-${noteId}`);
    try {
      await api(`/events/${event.id}/notes/${noteId}`, { method: "DELETE" });
      setNotes((current) => current.filter((item) => item.id !== noteId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The note could not be deleted.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <header className="border-b border-line pb-5">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="eyebrow text-burgundy">{titleCase(event.event_type)} · {event.city}</p>
              <RiskBadge level={event.risk_level} />
            </div>
            <h1 className="display mt-2 text-[clamp(2.2rem,4.6vw,4rem)]">{event.name}</h1>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-mute">
              <span className="flex items-center gap-1.5"><CalendarDays size={12} aria-hidden /> {formatDateTime(event.event_date)}</span>
              <span aria-hidden>·</span>
              <span>{event.guest_count} guests</span>
              <span aria-hidden>·</span>
              <span>{event.duration_hours || 5} hours</span>
              <span aria-hidden>·</span>
              <span>{labelFor(VENUE_TYPES, event.venue_type)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={13} aria-hidden /> Edit brief
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void generate()} disabled={busy === "generate"}>
              {busy === "generate" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RefreshCw size={13} aria-hidden />}
              {plan ? "Regenerate" : "Generate plan"}
            </Button>
            <a
              href={`/api/backend/events/${event.id}/export`}
              className="btn btn-ghost min-h-[38px] px-3 text-[10px]"
              download
            >
              <Download size={13} aria-hidden /> Export
            </a>
          </div>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="border border-line bg-[#fbf9f3] p-3.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink-mute">Budget</p>
          <p className="mt-1.5 font-display text-[26px] leading-none">{money(event.budget_cents)}</p>
          <p className="mt-1 text-[10px] text-ink-mute">{money((event.budget_cents / Math.max(event.guest_count, 1)))} / guest</p>
        </div>
        <div className="border border-ink bg-ink p-3.5 text-ivory">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-champagne">ML estimate</p>
          <p className="mt-1.5 font-display text-[26px] leading-none">{money(event.predicted_cost_cents)}</p>
          <p className="mt-1 text-[10px] text-[#a9a396]">
            {coverage ? `${coverage.toFixed(2)}x coverage` : "Model unavailable"}
          </p>
        </div>
        <div className="border border-line bg-[#fbf9f3] p-3.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink-mute">Logged spend</p>
          <p className="mt-1.5 font-display text-[26px] leading-none">{money(spent)}</p>
          <p className="mt-1 text-[10px] text-ink-mute">{money(paid)} paid · {event.budget_cents ? percent(spent / event.budget_cents) : "0%"} of budget</p>
        </div>
        <div className="border border-line bg-[#fbf9f3] p-3.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink-mute">Readiness</p>
          <p className="mt-1.5 font-display text-[26px] leading-none">{Math.round(progress * 100)}%</p>
          <div className="mt-1.5 h-1 w-full bg-ivory-deep">
            <div className="h-full bg-burgundy" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-ink-mute">{done} of {tasks.length} tasks</p>
        </div>
      </div>

      {error ? <div className="mt-4"><InlineError message={error} /></div> : null}
      {notice ? (
        <div className="mt-4 flex items-start justify-between gap-3 border-l-2 border-sage bg-sage-soft/40 px-3 py-2 text-[12px]">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[10px] uppercase tracking-[0.1em] text-ink-mute" aria-label="Dismiss notice">
            Close
          </button>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto border-b border-line">
        <nav aria-label="Event sections" className="flex min-w-max">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-current={tab === item.key ? "page" : undefined}
              className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                tab === item.key ? "border-burgundy text-ink" : "border-transparent text-ink-mute hover:text-ink"
              }`}
            >
              <item.icon size={13} aria-hidden />
              {item.label}
              {item.key === "checklist" && tasks.length ? (
                <span className="ml-0.5 text-[9px] tabular-nums text-ink-mute">{tasks.filter((task) => !task.done).length}</span>
              ) : null}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-5">
        {tab === "overview" ? (
          <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
            <div className="space-y-5">
              <Panel eyebrow="The brief" title="Requirements" action={<button type="button" onClick={() => setEditing(true)} className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-burgundy">Edit</button>}>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5 text-[12px] sm:grid-cols-3">
                  {[
                    ["Occasion", labelFor(EVENT_TYPES, event.event_type)],
                    ["Date", formatDate(event.event_date)],
                    ["City", event.city],
                    ["Location tier", titleCase(event.location_tier)],
                    ["Theme", labelFor(THEMES, event.theme)],
                    ["Venue", labelFor(VENUE_TYPES, event.venue_type)],
                    ["Catering", labelFor(CATERING_LEVELS, event.catering_level)],
                    ["Decoration", titleCase(event.decor_level)],
                    ["Photography", titleCase(event.photography)],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-line/60 pb-1.5">
                      <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-mute">{label}</dt>
                      <dd className="mt-0.5">{value}</dd>
                    </div>
                  ))}
                </dl>
                {event.accessibility ? (
                  <p className="mt-3 border-l-2 border-sage pl-2 text-[11.5px] text-ink-soft"><strong className="font-semibold">Accessibility:</strong> {event.accessibility}</p>
                ) : null}
                {event.notes ? (
                  <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-soft"><strong className="font-semibold">Notes:</strong> {event.notes}</p>
                ) : null}
              </Panel>

              {plan ? (
                <Panel eyebrow="Generated plan" title={plan.theme} action={<EngineBadge engine={planRecord?.engine ?? "fallback"} model={planRecord?.model} />}>
                  <p className="text-[12.5px] leading-relaxed text-ink-soft">{plan.event_summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setTab("plan")} className="btn btn-outline min-h-[36px] px-3 text-[10px]">Read the full plan</button>
                    <button type="button" onClick={() => setTab("budget")} className="btn btn-ghost min-h-[36px] px-3 text-[10px]">Budget &amp; expenses</button>
                  </div>
                </Panel>
              ) : (
                <EmptyState
                  icon={<Sparkles size={20} aria-hidden />}
                  title="No plan generated yet."
                  body="The brief is saved. Generate a structured plan with budget lines, timeline, event-day schedule, and a vendor checklist."
                  action={
                    <Button type="button" size="sm" onClick={() => void generate()} disabled={busy === "generate"}>
                      {busy === "generate" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Sparkles size={13} aria-hidden />}
                      {busy === "generate" ? "Generating" : "Generate plan"}
                    </Button>
                  }
                />
              )}

              {recommendations.length ? (
                <Panel eyebrow="Recommendation engine" title="Catalogue concepts">
                  <ul className="space-y-3">
                    {recommendations.slice(0, 3).map((item) => (
                      <li key={item.id} className="border-b border-line/70 pb-3 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[13px] font-semibold">{item.title}</p>
                          <span className="text-[9px] uppercase tracking-[0.1em] text-ink-mute">{Math.round(item.score * 100)}% fit</span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{item.description}</p>
                        <p className="mt-1 text-[10px] text-ink-mute">{item.estimated_cost_band}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-line pt-2.5 text-[10px] text-ink-mute">
                    Curated concepts, not verified vendors. No availability or booking is implied.
                  </p>
                </Panel>
              ) : null}
            </div>

            <div className="space-y-5">
              <Panel eyebrow="Budget-risk triage" title={riskInfo ? `${titleCase(riskInfo.risk_level)} risk` : "Awaiting assessment"}>
                {riskInfo ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <RiskBadge level={riskInfo.risk_level} />
                      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-mute">confidence {percent(riskInfo.confidence)}</span>
                    </div>
                    <p className="mt-3 text-[11.5px] leading-relaxed text-ink-soft">{riskInfo.definition}</p>
                    <dl className="mt-3 space-y-1.5 border-t border-line pt-2.5">
                      {riskInfo.drivers.map((driver) => (
                        <div key={driver.driver} className="flex justify-between gap-3 text-[11px]">
                          <dt className="text-ink-mute">{driver.driver}</dt>
                          <dd className="text-right">{driver.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 border-l-2 border-champagne pl-2 text-[10.5px] leading-relaxed text-ink-soft">{riskInfo.suggestions[0]}</p>
                    <p className="mt-2 text-[9.5px] text-ink-mute">Rule-derived triage, not a guarantee.</p>
                  </>
                ) : (
                  <p className="text-[11.5px] leading-relaxed text-ink-mute">
                    Risk triage appears when the cost model has produced an estimate for this event. Train the models to enable it.
                  </p>
                )}
              </Panel>

              <Panel eyebrow="Next actions" title="Open tasks">
                {tasks.filter((task) => !task.done).length === 0 ? (
                  <p className="text-[11.5px] text-ink-mute">Nothing outstanding. Add tasks in the checklist tab.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {tasks.filter((task) => !task.done).slice(0, 5).map((task) => (
                      <li key={task.id} className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => void toggleTask(task)}
                          aria-label={`Mark "${task.title}" complete`}
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-line hover:border-burgundy"
                        >
                          {busy === `task-${task.id}` ? <Loader2 size={10} className="animate-spin" aria-hidden /> : null}
                        </button>
                        <span className="text-[11.5px] leading-snug">{task.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={() => setTab("checklist")} className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-burgundy">
                  Open checklist <ArrowRight size={11} aria-hidden />
                </button>
              </Panel>

              {plan ? (
                <Panel eyebrow="Cost-saving moves" title="Protect the ceiling">
                  <ul className="space-y-2">
                    {plan.cost_saving_suggestions.slice(0, 3).map((suggestion) => (
                      <li key={suggestion} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-soft">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-burgundy" aria-hidden />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "plan" ? (
          plan ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-[#fbf9f3] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <EngineBadge engine={planRecord?.engine ?? "fallback"} model={planRecord?.model} />
                  <span className="text-[10.5px] text-ink-mute">
                    {planRecord ? `Generated ${formatDateTime(planRecord.created_at)}` : ""} · schema {planRecord?.schema_version}
                  </span>
                </div>
                <RevisionForm onGenerate={(notes) => void generate(notes)} busy={busy === "generate"} />
              </div>

              {plan.warnings.length ? (
                <div className="border border-[#d9c58f] bg-[#f6eed7] p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#715620]"><AlertTriangle size={13} aria-hidden /> Warnings</p>
                  <ul className="mt-2 space-y-1.5">
                    {plan.warnings.map((warning) => (
                      <li key={warning} className="text-[11.5px] leading-relaxed text-[#5f4a1d]">{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Panel eyebrow="Direction" title={plan.theme}>
                <p className="text-[13px] leading-relaxed text-ink-soft">{plan.event_summary}</p>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel eyebrow="Budget lines" title="How the budget is allocated">
                  <ul className="space-y-2.5">
                    {plan.budget_breakdown.map((line) => {
                      const share = event.budget_cents ? line.amount_cents / event.budget_cents : 0;
                      return (
                        <li key={`${line.category}-${line.amount_cents}`}>
                          <div className="flex items-baseline justify-between gap-3 text-[12px]">
                            <span>{line.category}</span>
                            <span className="tabular-nums">{money(line.amount_cents)}</span>
                          </div>
                          <div className="mt-1 h-1 w-full bg-ivory-deep">
                            <div className="h-full bg-champagne" style={{ width: `${Math.min(100, share * 100)}%` }} />
                          </div>
                          {line.note ? <p className="mt-0.5 text-[9.5px] text-ink-mute">{line.note}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-line pt-2.5 text-[11.5px] font-semibold">
                    <span>Total lines</span>
                    <span>{money(plan.budget_breakdown.reduce((total, line) => total + line.amount_cents, 0))}</span>
                  </div>
                </Panel>

                <Panel eyebrow="Studio notes" title="Recommendations">
                  <ul className="space-y-2.5">
                    {plan.recommendations.map((item) => (
                      <li key={item} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-soft">
                        <Check size={13} aria-hidden className="mt-0.5 shrink-0 text-burgundy" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel eyebrow="Cost control" title="Ways to save">
                  <ul className="space-y-2.5">
                    {plan.cost_saving_suggestions.map((item) => (
                      <li key={item} className="border-b border-line/60 pb-2 text-[11.5px] leading-relaxed text-ink-soft last:border-0 last:pb-0">{item}</li>
                    ))}
                  </ul>
                </Panel>
                <Panel eyebrow="Honesty" title="Assumptions">
                  <ul className="space-y-2">
                    {plan.assumptions.map((item) => (
                      <li key={item} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-soft">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-mute" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-line pt-2.5 text-[10px] text-ink-mute">
                    Generated plans are planning guidance. No vendor availability, price, or booking is verified.
                  </p>
                </Panel>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles size={22} aria-hidden />}
              title="The brief is ready. The plan is not."
              body="Generate a schema-validated plan using the configured AI provider or the deterministic fallback."
              action={<Button type="button" size="sm" onClick={() => void generate()} disabled={busy === "generate"}>Generate plan</Button>}
            />
          )
        ) : null}

        {tab === "timeline" ? (
          plan ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Panel eyebrow="Preparation" title="Working backwards">
                <ol className="space-y-5">
                  {plan.preparation_timeline.map((phase, index) => (
                    <li key={`${phase.phase}-${index}`} className="relative border-l border-line pl-5">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-burgundy bg-ivory" aria-hidden />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-[13px] font-semibold">{phase.phase}</h3>
                        <span className="text-[9.5px] uppercase tracking-[0.1em] text-burgundy">{phase.timing}</span>
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {phase.actions.map((action) => (
                          <li key={action} className="text-[11.5px] leading-relaxed text-ink-soft">— {action}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel eyebrow={`Event day · ${formatDate(event.event_date)}`} title="Event-day flow">
                <EventFlowchart items={plan.event_day_schedule} />
              </Panel>
            </div>
          ) : (
            <EmptyState icon={<CalendarDays size={22} aria-hidden />} title="No event flow yet." body="Generate a plan to see the preparation timeline and a step-by-step event-day flowchart." />
          )
        ) : null}

        {tab === "reception" ? (
          <div className="space-y-5">
            <section className="grid gap-4 border border-line bg-[#fbf9f3] p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
              <div>
                <p className="eyebrow text-burgundy">The celebration, thoughtfully paced</p>
                <h2 className="mt-1 font-display text-[26px]">Reception planning</h2>
                <p className="mt-2 max-w-[62ch] text-[12px] leading-relaxed text-ink-soft">
                  Coordinate the room, meal, music, suppliers, and key moments. Your checklist is saved with this event.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-[240px]">
                <div className="border border-line bg-ivory p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-mute">Guests</p>
                  <p className="mt-1 font-display text-[21px]">{event.guest_count}</p>
                </div>
                <div className="border border-line bg-ivory p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-mute">Reception budget</p>
                  <p className="mt-1 font-display text-[21px]">{money(event.budget_cents)}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Panel
                eyebrow="Room, meal, music & handoffs"
                title={`Reception checklist · ${tasks.filter((task) => task.category.toLowerCase() === "reception" && task.done).length}/${tasks.filter((task) => task.category.toLowerCase() === "reception").length}`}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void addReceptionChecklist()}
                    disabled={busy === "reception-checklist"}
                  >
                    {busy === "reception-checklist" ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Plus size={12} aria-hidden />}
                    Add essentials
                  </Button>
                }
              >
                {tasks.filter((task) => task.category.toLowerCase() === "reception").length ? (
                  <ul className="space-y-1">
                    {tasks.filter((task) => task.category.toLowerCase() === "reception").map((task) => (
                      <li key={task.id} className="group flex items-start gap-3 border-b border-line/60 py-2.5 last:border-0">
                        <button
                          type="button"
                          onClick={() => void toggleTask(task)}
                          aria-label={task.done ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
                          aria-pressed={task.done}
                          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors ${
                            task.done ? "border-burgundy bg-burgundy text-ivory" : "border-line hover:border-burgundy"
                          }`}
                        >
                          {busy === `task-${task.id}` ? <Loader2 size={10} className="animate-spin" aria-hidden /> : task.done ? <Check size={11} aria-hidden /> : null}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[12px] leading-snug ${task.done ? "text-ink-mute line-through" : ""}`}>{task.title}</p>
                          {task.due_date ? <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-ink-mute">Due {formatDate(task.due_date, "short")}</p> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteTask(task.id)}
                          aria-label={`Delete "${task.title}"`}
                          className="mt-0.5 text-ink-mute opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                        >
                          {busy === `delete-task-${task.id}` ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Trash2 size={13} aria-hidden />}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-3 text-[12px] leading-relaxed text-ink-mute">
                    Start with the essentials, then tailor the checklist to your reception.
                  </p>
                )}
                <AddTaskForm onAdd={addTask} busy={busy === "add-task"} defaultCategory="reception" idPrefix="reception-task" />
              </Panel>

              <Panel eyebrow={`Reception day · ${formatDateTime(event.event_date)}`} title="Run of show">
                {plan ? (
                  <EventFlowchart items={plan.event_day_schedule} />
                ) : (
                  <div className="space-y-3">
                    <p className="text-[12px] leading-relaxed text-ink-soft">
                      Generate an event plan to build a time-ordered run of show from your event brief.
                    </p>
                    <Button type="button" size="sm" onClick={() => void generate()} disabled={busy === "generate"}>
                      {busy === "generate" ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Sparkles size={12} aria-hidden />}
                      Generate reception timeline
                    </Button>
                  </div>
                )}
              </Panel>
            </div>

            <Panel eyebrow="Keep the handoffs clear" title="Reception-day reminders">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Before guests arrive", "Walk the room, check place settings, sound, lighting, and signage."],
                  ["Guest welcome", "Give ushers and the venue lead the seating plan and accessibility notes."],
                  ["During dinner", "Agree who cues courses, speeches, and any special moments."],
                  ["Before close", "Confirm transport, supplier pack-down, lost property, and final venue check."],
                ].map(([title, detail]) => (
                  <article key={title} className="border border-line/70 bg-ivory p-3">
                    <h3 className="text-[11px] font-semibold">{title}</h3>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-soft">{detail}</p>
                  </article>
                ))}
              </div>
              <p className="mt-3 border-t border-line pt-2.5 text-[10px] text-ink-mute">
                Use the Budget tab for reception quotes and payments. Availability and bookings are not verified by Eventora.
              </p>
            </Panel>
          </div>
        ) : null}

        {tab === "checklist" ? (
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <Panel
              eyebrow="Vendor & operations"
              title={`Checklist · ${done}/${tasks.length}`}
              action={<span className="text-[10px] uppercase tracking-[0.1em] text-ink-mute">{Math.round(progress * 100)}% complete</span>}
            >
              {tasks.length === 0 ? (
                <p className="py-4 text-[12px] text-ink-mute">No tasks. Generate a plan to seed the vendor checklist, or add one below.</p>
              ) : (
                <ul className="space-y-1">
                  {tasks.map((task) => (
                    <li key={task.id} className="group flex items-start gap-3 border-b border-line/60 py-2.5 last:border-0">
                      <button
                        type="button"
                        onClick={() => void toggleTask(task)}
                        aria-label={task.done ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
                        aria-pressed={task.done}
                        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors ${
                          task.done ? "border-burgundy bg-burgundy text-ivory" : "border-line hover:border-burgundy"
                        }`}
                      >
                        {busy === `task-${task.id}` ? <Loader2 size={10} className="animate-spin" aria-hidden /> : task.done ? <Check size={11} aria-hidden /> : null}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] leading-snug ${task.done ? "text-ink-mute line-through" : ""}`}>{task.title}</p>
                        <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-ink-mute">
                          {task.category}
                          {task.due_date ? ` · due ${formatDate(task.due_date, "short")}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteTask(task.id)}
                        aria-label={`Delete "${task.title}"`}
                        className="mt-0.5 text-ink-mute opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                      >
                        {busy === `delete-task-${task.id}` ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Trash2 size={13} aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <AddTaskForm onAdd={addTask} busy={busy === "add-task"} />
            </Panel>

            <div className="space-y-5">
              <Panel eyebrow="Supplier etiquette" title="What actually gets confirmed">
                <ul className="space-y-2.5 text-[11.5px] leading-relaxed text-ink-soft">
                  <li>— Written quote with service charge, tax, overtime, and travel separated.</li>
                  <li>— Load-in time, access restrictions, power, and insurance requirements.</li>
                  <li>— Cancellation, postponement, and weather terms in the contract.</li>
                  <li>— Final headcount and dietary matrix deadlines.</li>
                  <li>— Named on-site contact and escalation number for each supplier.</li>
                </ul>
                <p className="mt-3 border-t border-line pt-2.5 text-[10px] text-ink-mute">
                  Eventora does not verify availability or bookings. These are your records.
                </p>
              </Panel>
              <Panel eyebrow="Catalogue checklist" title="From the generated plan">
                {plan ? (
                  <ul className="space-y-2">
                    {plan.vendor_checklist.map((item) => (
                      <li key={item.item} className="flex justify-between gap-3 border-b border-line/60 pb-1.5 text-[11px] last:border-0">
                        <span>{item.item}</span>
                        <span className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-ink-mute">{item.priority}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11.5px] text-ink-mute">Generate a plan to see its vendor checklist.</p>
                )}
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "budget" ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-line bg-[#fbf9f3] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-mute">Budget</p>
                <p className="mt-1.5 font-display text-[28px]">{money(event.budget_cents)}</p>
              </div>
              <div className="border border-line bg-[#fbf9f3] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-mute">Logged</p>
                <p className="mt-1.5 font-display text-[28px]">{money(spent)}</p>
                <p className="text-[10px] text-ink-mute">{money(paid)} paid</p>
              </div>
              <div className={`border p-4 ${spent > event.budget_cents ? "border-danger bg-[#f6e9e6]" : "border-line bg-[#fbf9f3]"}`}>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-mute">Remaining</p>
                <p className="mt-1.5 font-display text-[28px]">{money(event.budget_cents - spent)}</p>
                <p className="text-[10px] text-ink-mute">{event.budget_cents ? percent(spent / event.budget_cents) : "0%"} committed</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
              <Panel eyebrow="Expense tracking" title="Logged expenses">
                {expenses.length === 0 ? (
                  <p className="py-3 text-[12px] text-ink-mute">No expenses logged. Add deposits, quotes, and payments below.</p>
                ) : (
                  <ul className="divide-y divide-line/70">
                    {expenses.map((expense) => (
                      <li key={expense.id} className="group flex items-center gap-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => void toggleExpense(expense)}
                          aria-pressed={expense.paid}
                          aria-label={expense.paid ? `Mark ${expense.label} unpaid` : `Mark ${expense.label} paid`}
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border ${
                            expense.paid ? "border-sage bg-sage text-ink" : "border-line hover:border-burgundy"
                          }`}
                        >
                          {busy === `expense-${expense.id}` ? <Loader2 size={10} className="animate-spin" aria-hidden /> : expense.paid ? <Check size={11} aria-hidden /> : null}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px]">{expense.label}</p>
                          <p className="text-[9.5px] uppercase tracking-[0.08em] text-ink-mute">{expense.category} · {expense.paid ? "paid" : "unpaid"}</p>
                        </div>
                        <span className="tabular-nums text-[12px]">{money(expense.amount_cents)}</span>
                        <button
                          type="button"
                          onClick={() => void deleteExpense(expense.id)}
                          aria-label={`Delete ${expense.label}`}
                          className="text-ink-mute opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                        >
                          {busy === `delete-expense-${expense.id}` ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Trash2 size={12} aria-hidden />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <AddExpenseForm onAdd={addExpense} busy={busy === "add-expense"} />
              </Panel>

              <Panel eyebrow="Generated allocation" title="Plan budget breakdown">
                {plan ? (
                  <ul className="space-y-2.5">
                    {plan.budget_breakdown.map((line) => (
                      <li key={`${line.category}-${line.amount_cents}`} className="flex justify-between gap-3 border-b border-line/60 pb-1.5 text-[11.5px] last:border-0">
                        <span>{line.category}</span>
                        <span className="tabular-nums">{money(line.amount_cents)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11.5px] text-ink-mute">Generate a plan to see proposed budget lines. Your logged expenses are independent of the allocation.</p>
                )}
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <Panel eyebrow="Private workspace" title="Working notes">
              {notes.length === 0 ? (
                <p className="py-3 text-[12px] text-ink-mute">No notes yet. Capture decisions, family logistics, or supplier calls.</p>
              ) : (
                <ul className="space-y-3">
                  {notes.map((note) => (
                    <li key={note.id} className="group border-b border-line/70 pb-3 last:border-0">
                      <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-soft">{note.body}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span className="text-[9.5px] uppercase tracking-[0.08em] text-ink-mute">{formatDateTime(note.created_at)}</span>
                        <button type="button" onClick={() => void deleteNote(note.id)} aria-label="Delete note" className="text-ink-mute opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100">
                          {busy === `delete-note-${note.id}` ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Trash2 size={12} aria-hidden />}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <AddNoteForm onAdd={addNote} busy={busy === "add-note"} />
            </Panel>
            <Panel eyebrow="Privacy" title="How notes are handled">
              <ul className="space-y-2.5 text-[11.5px] leading-relaxed text-ink-soft">
                <li>— Notes are visible only to your account, enforced on every API read.</li>
                <li>— They are not indexed by search engines and API responses are no-store.</li>
                <li>— They are never logged in full by the server.</li>
                <li>— If you add them to an AI prompt, they are treated as untrusted data and length-limited.</li>
                <li>— Delete a note here, or delete all event data from Settings.</li>
              </ul>
            </Panel>
          </div>
        ) : null}

        {tab === "assistant" ? (
          <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <AssistantPanel event={event} plan={plan} />
            <div className="space-y-5">
              <Panel eyebrow="What the assistant can see" title="Grounded context">
                <ul className="space-y-2 text-[11.5px] leading-relaxed text-ink-soft">
                  <li>— Event brief: occasion, date, city, guests, budget, theme, venue, service levels.</li>
                  <li>— Accessibility notes and your saved notes.</li>
                  <li>— The latest generated plan summary, budget lines, and first timeline phases.</li>
                  <li>— Up to six recent chat turns (sent with the request, not stored).</li>
                </ul>
              </Panel>
              <Panel eyebrow="Boundaries" title="What it cannot do">
                <ul className="space-y-2 text-[11.5px] leading-relaxed text-ink-soft">
                  <li>— Check vendor availability, quote prices, or make bookings.</li>
                  <li>— Change records, execute code, or access other accounts.</li>
                  <li>— Guarantee budget outcomes or model accuracy.</li>
                </ul>
                <p className="mt-3 border-t border-line pt-2.5 text-[10px] text-ink-mute">
                  Provider keys are server-side. If the provider fails, replies are labelled as coming from the
                  deterministic local assistant.
                </p>
              </Panel>
            </div>
          </div>
        ) : null}
      </div>

      {editing ? (
        <BriefEditor
          event={event}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEvent(updated);
            setNotice("Brief updated. Estimate and risk refreshed.");
            if (updated.predicted_cost_cents) {
              void api<BudgetRisk>("/ml/budget-risk", {
                method: "POST",
                body: {
                  event_type: updated.event_type,
                  guest_count: updated.guest_count,
                  budget_cents: updated.budget_cents,
                  predicted_cost_cents: updated.predicted_cost_cents,
                  contingency_pct: 8,
                },
              }).then(setRiskInfo).catch(() => setRiskInfo(null));
            }
          }}
        />
      ) : null}
    </div>
  );
}

function RevisionForm({ onGenerate, busy }: { onGenerate: (notes: string) => void; busy: boolean }) {
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-burgundy">
        <RefreshCw size={12} aria-hidden /> Revise plan
      </button>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onGenerate(notes);
        setOpen(false);
        setNotes("");
      }}
      className="flex w-full items-end gap-2 sm:w-auto"
    >
      <div className="flex-1">
        <label htmlFor="revision-notes" className="sr-only">Revision notes</label>
        <input
          id="revision-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={600}
          placeholder="e.g. trim the budget by 10%, more colour"
          className="field-input min-h-[36px] py-1.5 text-[11.5px]"
        />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
        {busy ? "Revising" : "Apply"}
      </Button>
    </form>
  );
}

function AddTaskForm({
  onAdd,
  busy,
  defaultCategory = "vendor",
  idPrefix = "task",
}: {
  onAdd: (title: string, category: string, due: string) => Promise<void>;
  busy: boolean;
  defaultCategory?: string;
  idPrefix?: string;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [due, setDue] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onAdd(title, category, due).then(() => {
          setTitle("");
          setDue("");
        });
      }}
      className="mt-4 border-t border-line pt-3"
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_105px_130px_auto]">
        <div>
          <label htmlFor={`${idPrefix}-title`} className="sr-only">Task</label>
          <input id={`${idPrefix}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Add a task…" className="field-input min-h-[38px] text-[12px]" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-category`} className="sr-only">Category</label>
          <select id={`${idPrefix}-category`} value={category} onChange={(event) => setCategory(event.target.value)} className="field-input min-h-[38px] text-[12px]">
            {["vendor", "venue", "catering", "decor", "budget", "guest experience", "operations", "reception", "risk", "general"].map((option) => (
              <option key={option} value={option}>{titleCase(option)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-due`} className="sr-only">Due date</label>
          <input id={`${idPrefix}-due`} type="date" value={due} onChange={(event) => setDue(event.target.value)} className="field-input min-h-[38px] text-[12px]" />
        </div>
        <Button type="submit" size="sm" disabled={busy || title.trim().length < 2}>
          {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Plus size={12} aria-hidden />} Add
        </Button>
      </div>
    </form>
  );
}

function AddExpenseForm({ onAdd, busy }: { onAdd: (label: string, category: string, amount: string, paid: boolean) => Promise<void>; busy: boolean }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("venue");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onAdd(label, category, amount, paid).then(() => {
          setLabel("");
          setAmount("");
          setPaid(false);
        });
      }}
      className="mt-4 border-t border-line pt-3"
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_110px_100px_auto_auto]">
        <div>
          <label htmlFor="expense-label" className="sr-only">Expense</label>
          <input id="expense-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} placeholder="Deposit, quote, supplier…" className="field-input min-h-[38px] text-[12px]" />
        </div>
        <div>
          <label htmlFor="expense-category" className="sr-only">Category</label>
          <select id="expense-category" value={category} onChange={(event) => setCategory(event.target.value)} className="field-input min-h-[38px] text-[12px]">
            {["venue", "catering", "decor", "photography", "music", "attire", "stationery", "transport", "other"].map((option) => (
              <option key={option} value={option}>{titleCase(option)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expense-amount" className="sr-only">Amount</label>
          <input id="expense-amount" type="number" min={1} step={0.01} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="USD" className="field-input min-h-[38px] text-[12px]" />
        </div>
        <label className="flex min-h-[38px] items-center gap-1.5 border border-line px-2 text-[10.5px]">
          <input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} className="accent-[#702E3D]" />
          Paid
        </label>
        <Button type="submit" size="sm" disabled={busy || label.trim().length < 2 || !amount}>
          {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Plus size={12} aria-hidden />} Log
        </Button>
      </div>
    </form>
  );
}

function AddNoteForm({ onAdd, busy }: { onAdd: (body: string) => Promise<void>; busy: boolean }) {
  const [body, setBody] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onAdd(body).then(() => setBody(""));
      }}
      className="mt-4 border-t border-line pt-3"
    >
      <label htmlFor="note-body" className="field-label">New note</label>
      <textarea
        id="note-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Decision, supplier call, family logistics…"
        className="field-input resize-y text-[12px]"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-ink-mute">{body.length}/2000</span>
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <NotebookPen size={12} aria-hidden />} Save note
        </Button>
      </div>
    </form>
  );
}
