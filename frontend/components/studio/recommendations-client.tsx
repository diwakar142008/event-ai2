"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, InlineError } from "@/components/studio/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client";
import { money, titleCase } from "@/lib/format";
import type { EventRecord, RecommendationItem, RecommendationResult } from "@/lib/types";

const KINDS = ["all", "theme", "decor", "catering", "activity", "service"] as const;

const KIND_LABELS: Record<(typeof KINDS)[number], string> = {
  all: "All concepts",
  theme: "Themes",
  decor: "Decor",
  catering: "Catering",
  activity: "Activities",
  service: "Services",
};

export function RecommendationsClient({ events }: { events: EventRecord[] }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => events.find((event) => event.id === selectedId) ?? null, [events, selectedId]);

  async function load(event: EventRecord) {
    setLoading(true);
    setError(null);
    try {
      const response = await api<RecommendationResult>("/ml/recommend", {
        method: "POST",
        body: {
          event_type: event.event_type,
          guest_count: event.guest_count,
          budget_cents: event.budget_cents,
          style: event.theme,
          venue_type: event.venue_type,
          limit: 12,
        },
      });
      setResult(response);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : "Recommendations are unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selected) void load(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!events.length) {
    return (
      <EmptyState
        icon={<Sparkles size={22} aria-hidden />}
        title="Recommendations need an event."
        body="Create a brief first. The engine reads occasion, guest count, budget, style, and venue to rank catalogue concepts."
        action={<ButtonLink href="/events/new" size="sm">Create an event</ButtonLink>}
      />
    );
  }

  const visible = result?.items.filter((item) => kind === "all" || item.kind === kind) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border border-line bg-[#fbf9f3] p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-[420px]">
          <label htmlFor="recommendation-event" className="field-label">Event</label>
          <select
            id="recommendation-event"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="field-input"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} — {titleCase(event.event_type)}, {event.guest_count} guests
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selected ? (
            <div className="text-[10.5px] leading-relaxed text-ink-mute">
              <p>{titleCase(selected.theme)} · {money(selected.budget_cents)} · {money(selected.budget_cents / Math.max(selected.guest_count, 1))}/guest</p>
              <p>{titleCase(selected.venue_type)} · {selected.city}</p>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => selected && void load(selected)}
            disabled={loading || !selected}
          >
            {loading ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RefreshCw size={13} aria-hidden />}
            {loading ? "Ranking" : "Re-rank"}
          </Button>
        </div>
      </div>

      {error ? <InlineError message={error} /> : null}

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            aria-pressed={kind === option}
            className={`border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
              kind === option ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-ink"
            }`}
          >
            {KIND_LABELS[option]}
          </button>
        ))}
      </div>

      {loading && !result ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-[190px] animate-pulse border border-line bg-ivory-deep/50" />
          ))}
        </div>
      ) : null}

      {result && visible.length === 0 ? (
        <EmptyState title="No concepts in this category." body="Choose another category or re-rank with a different event." />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((item) => (
          <article key={item.id} className="flex flex-col border border-line bg-[#fbf9f3]">
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-burgundy">{titleCase(item.kind)}</p>
                <h3 className="mt-0.5 font-display text-[24px] leading-tight">{item.title}</h3>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-[24px] leading-none">{Math.round(item.score * 100)}</p>
                <p className="text-[8.5px] uppercase tracking-[0.1em] text-ink-mute">similarity</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="text-[12px] leading-relaxed text-ink-soft">{item.description}</p>
              <div className="mt-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-mute">Why it surfaced</p>
                <ul className="mt-1.5 space-y-1.5">
                  {item.reasons.map((reason) => (
                    <li key={reason} className="flex gap-2 text-[11px] leading-relaxed text-ink-soft">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-champagne" aria-hidden />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-[10px] text-ink-mute">
                <span>{item.estimated_cost_band}</span>
                <span className="text-right">Catalogue</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {result ? (
        <div className="border border-line p-3.5 text-[10.5px] leading-relaxed text-ink-mute">
          <strong className="text-ink-soft">{result.model.name}</strong> · {result.model.catalogue_size} catalogue entries.{" "}
          {result.disclaimer} The score is content similarity, not a probability of satisfaction.
        </div>
      ) : null}
    </div>
  );
}
