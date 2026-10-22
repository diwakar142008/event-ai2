"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

import { api, ApiError } from "@/lib/client";
import { money, titleCase } from "@/lib/format";
import type { CostPrediction } from "@/lib/types";

const eventTypes = [
  "wedding",
  "engagement",
  "birthday",
  "anniversary",
  "college_festival",
  "cultural_event",
  "community_celebration",
  "corporate_event",
  "private_party",
];

export function CostEstimator() {
  const [form, setForm] = useState({
    event_type: "wedding",
    guest_count: 120,
    location_tier: "metro",
    venue_type: "garden_outdoor",
    catering_level: "full",
    decor_level: "classic",
    photography: "full",
    duration_hours: 6,
  });
  const [result, setResult] = useState<CostPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function estimate() {
    setLoading(true);
    setError(null);
    try {
      const prediction = await api<CostPrediction>("/ml/predict-cost", {
        method: "POST",
        body: form,
      });
      setResult(prediction);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The cost model is unavailable right now.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="border border-line-dark bg-analytics-soft/80 p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-champagne">Try a sample estimate</p>
          <h3 className="mt-1 font-display text-2xl text-ivory">Estimate your event cost</h3>
        </div>
        <span className="label-chip border-line-dark text-[9px] text-[#b9b3a4]">Sample estimate (USD)</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow mb-1.5 block text-[9px] text-[#a9a396]">Occasion</span>
          <select
            value={form.event_type}
            onChange={(event) => update("event_type", event.target.value)}
            className="h-10 w-full border border-line-dark bg-analytics px-2.5 text-sm text-ivory"
          >
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {titleCase(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block text-[9px] text-[#a9a396]">Guests · {form.guest_count}</span>
          <input
            type="range"
            min={20}
            max={600}
            step={10}
            value={form.guest_count}
            onChange={(event) => update("guest_count", Number(event.target.value))}
            className="h-10 w-full accent-[#c8b58a]"
            aria-label="Guest count"
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block text-[9px] text-[#a9a396]">Location</span>
          <select
            value={form.location_tier}
            onChange={(event) => update("location_tier", event.target.value)}
            className="h-10 w-full border border-line-dark bg-analytics px-2.5 text-sm text-ivory"
          >
            <option value="metro">Metro</option>
            <option value="large_city">Large city</option>
            <option value="regional">Regional</option>
          </select>
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block text-[9px] text-[#a9a396]">Venue</span>
          <select
            value={form.venue_type}
            onChange={(event) => update("venue_type", event.target.value)}
            className="h-10 w-full border border-line-dark bg-analytics px-2.5 text-sm text-ivory"
          >
            <option value="garden_outdoor">Garden / outdoor</option>
            <option value="hotel_ballroom">Hotel ballroom</option>
            <option value="loft_indoor">Loft</option>
            <option value="banquet_hall">Banquet hall</option>
            <option value="community_hall">Community hall</option>
            <option value="private_residence">Private residence</option>
          </select>
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block text-[9px] text-[#a9a396]">Catering</span>
          <select
            value={form.catering_level}
            onChange={(event) => update("catering_level", event.target.value)}
            className="h-10 w-full border border-line-dark bg-analytics px-2.5 text-sm text-ivory"
          >
            <option value="none">None</option>
            <option value="light">Light</option>
            <option value="full">Full service</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block text-[9px] text-[#a9a396]">Decor</span>
          <select
            value={form.decor_level}
            onChange={(event) => update("decor_level", event.target.value)}
            className="h-10 w-full border border-line-dark bg-analytics px-2.5 text-sm text-ivory"
          >
            <option value="minimal">Minimal</option>
            <option value="classic">Classic</option>
            <option value="luxe">Luxe</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={estimate}
        disabled={loading}
        className="btn btn-light mt-5 w-full min-h-[44px] text-[11px]"
      >
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {loading ? "Estimating..." : "Estimate this event"}
        {!loading ? <ArrowRight size={15} aria-hidden /> : null}
      </button>

      {error ? (
        <p role="alert" className="mt-4 border border-[#6a3a3a] bg-[#2a1c1c] px-3 py-2 text-[13px] text-[#e7c9c9]">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-5 border-t border-line-dark pt-5">
          <p className="eyebrow text-[9px] text-[#a9a396]">Estimated total (sample-based guide)</p>
          <p className="mt-1 font-display text-5xl text-ivory">{money(result.predicted_cost_cents)}</p>
          <p className="mt-1 text-[13px] text-[#bdb6a7]">
            {money(result.cost_per_guest_cents)} per guest · {result.guest_count} guests
          </p>
          <ul className="mt-4 space-y-1.5 text-[12px] text-[#c9c2b2]">
            {result.factors.slice(0, 3).map((factor) => (
              <li key={factor.name} className="flex justify-between gap-3 border-b border-line-dark/60 pb-1.5">
                <span>{titleCase(factor.name)}</span>
                <span className="tabular-nums text-[#8f897c]">{factor.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-[#8f897c]">
            This is a sample-based estimate, not a supplier quote. Confirm current prices before booking.
          </p>
        </div>
      ) : null}
    </div>
  );
}
