"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { EVENT_TYPES } from "@/lib/options";

const COLORS: Record<string, string> = {
  wedding: "#702e3d",
  engagement: "#54202c",
  birthday: "#171715",
  anniversary: "#b2934c",
  college_festival: "#8c7440",
  cultural_event: "#66795e",
  community_celebration: "#55534d",
  corporate_event: "#927b4b",
  private_party: "#8a5a56",
};

type OccasionCount = { event_type: string; count: number };

export function OccasionChart({ data = [] }: { data?: OccasionCount[] | null }) {
  const occasions = (Array.isArray(data) ? data : []).map((item) => ({
    key: item.event_type,
    name: EVENT_TYPES.find((event) => event.value === item.event_type)?.label ?? item.event_type,
    value: item.count,
    color: COLORS[item.event_type] ?? "#514b43",
  }));
  const total = occasions.reduce((sum, occasion) => sum + occasion.value, 0);

  if (!total) {
    return (
      <div className="grid items-center gap-4 border border-dashed border-line bg-ivory p-4 sm:grid-cols-[220px_1fr] sm:px-6 sm:py-5">
        <div className="relative mx-auto h-[220px] w-[220px]" role="img" aria-label="Occasion mix chart: no events yet">
          <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="120" cy="120" r="88" fill="none" stroke="#d9d2c4" strokeWidth="24" />
          </svg>
          <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[40px] leading-none">0</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-mute">events</span>
          </div>
        </div>
        <div className="py-3 text-center sm:text-left">
          <p className="font-display text-[24px]">Your events will appear here.</p>
          <p className="mx-auto mt-2 max-w-[48ch] text-[13px] leading-relaxed text-ink-mute sm:mx-0">
            Add your first event to see how your plans are distributed by occasion. This chart uses your saved events only.
          </p>
          <Link href="/events/new" className="mt-4 inline-flex min-h-10 items-center gap-2 bg-ink px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-ivory transition-colors hover:bg-burgundy">
            Create your first event <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(210px,0.9fr)_1.1fr]">
      <div className="relative h-[260px] min-w-0" role="img" aria-label={`Doughnut chart showing ${total} events across ${occasions.length} occasion categories`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={occasions}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="#fbf9f3"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {occasions.map((occasion) => (
                <Cell key={occasion.key} fill={occasion.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#171715",
                border: "1px solid #514b43",
                borderRadius: 2,
                color: "#fffdf8",
                fontSize: 12,
                padding: "8px 10px",
              }}
              formatter={(value: unknown, name: unknown) => {
                const count = Number(value) || 0;
                return [`${count} event${count === 1 ? "" : "s"} (${Math.round((count / total) * 100)}%)`, String(name ?? "")];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[38px] leading-none tabular-nums">{total}</span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-mute">{total === 1 ? "event" : "events"}</span>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {occasions.map((occasion) => (
          <li key={occasion.key} className="flex min-h-10 items-center justify-between gap-3 border-b border-line py-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: occasion.color }} aria-hidden="true" />
              <span className="truncate">{occasion.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink-soft">
              {occasion.value} <span className="text-ink-mute">({Math.round((occasion.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
