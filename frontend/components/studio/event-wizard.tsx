"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client";
import { money, titleCase } from "@/lib/format";
import {
  CATERING_LEVELS,
  DECOR_LEVELS,
  EVENT_TYPES,
  LOCATION_TIERS,
  PHOTOGRAPHY_LEVELS,
  THEMES,
  VENUE_TYPES,
  labelFor,
} from "@/lib/options";
import type { BudgetRisk, CostPrediction, EventRecord } from "@/lib/types";

function defaultDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 6);
  date.setHours(16, 0, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

const initialForm = {
  event_type: "wedding",
  name: "",
  event_date: defaultDate(),
  city: "",
  location_tier: "metro",
  guest_count: "120",
  budget: "30000",
  duration_hours: "5",
  theme: "romantic_garden",
  venue_type: "garden_outdoor",
  catering_level: "full",
  decor_level: "classic",
  photography: "full",
  accessibility: "",
  notes: "",
};

type FormState = typeof initialForm;

const steps = [
  { number: "01", title: "The occasion", note: "Date, place, and guests" },
  { number: "02", title: "The details", note: "Style, venue, and services" },
  { number: "03", title: "Review", note: "Check your estimate" },
];

export function EventWizard({ initialEventType = "wedding" }: { initialEventType?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    event_type: EVENT_TYPES.some((option) => option.value === initialEventType) ? initialEventType : "wedding",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<CostPrediction | null>(null);
  const [risk, setRisk] = useState<BudgetRisk | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [creating, setCreating] = useState(false);

  const budgetCents = Math.round(Number(form.budget || 0) * 100);
  const guestCount = Number(form.guest_count || 0);
  const perGuest = guestCount > 0 ? budgetCents / guestCount : 0;

  const summary = useMemo(
    () => [
      ["Occasion", labelFor(EVENT_TYPES, form.event_type)],
      ["Date", form.event_date ? new Date(form.event_date).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }) : "—"],
      ["City", form.city || "—"],
      ["Guests", guestCount ? String(guestCount) : "—"],
      ["Budget", budgetCents ? money(budgetCents) : "—"],
      ["Direction", labelFor(THEMES, form.theme)],
      ["Venue", labelFor(VENUE_TYPES, form.venue_type)],
      ["Catering", labelFor(CATERING_LEVELS, form.catering_level)],
    ],
    [form, budgetCents, guestCount],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setPrediction(null);
    setRisk(null);
  }

  function validateStep(index: number): boolean {
    const next: Record<string, string> = {};
    if (index === 0) {
      if (form.name.trim().length < 2) next.name = "Give the event a name of at least 2 characters.";
      if (!form.event_date) next.event_date = "Choose a date and time.";
      else {
        const date = new Date(form.event_date);
        const limit = new Date();
        limit.setFullYear(limit.getFullYear() + 10);
        if (Number.isNaN(date.getTime()) || date > limit) next.event_date = "Choose a date within the next ten years.";
      }
      if (form.city.trim().length < 2) next.city = "Enter a city or location.";
      if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 5000)
        next.guest_count = "Guest count must be a whole number between 1 and 5,000.";
      if (!Number.isFinite(Number(form.budget)) || budgetCents < 10_000 || budgetCents > 2_000_000_000)
        next.budget = "Budget must be between $100 and $20,000,000.";
      const duration = Number(form.duration_hours);
      if (!Number.isFinite(duration) || duration < 1 || duration > 24) next.duration_hours = "Duration must be 1–24 hours.";
    }
    if (index === 1) {
      if (form.notes.length > 2000) next.notes = "Keep notes under 2,000 characters.";
      if (form.accessibility.length > 300) next.accessibility = "Keep accessibility notes under 300 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(2, current + 1));
  }

  async function estimate() {
    setEstimating(true);
    setServerError(null);
    try {
      const payload = {
        event_type: form.event_type,
        guest_count: guestCount,
        location_tier: form.location_tier,
        venue_type: form.venue_type,
        duration_hours: Number(form.duration_hours),
        catering_level: form.catering_level,
        decor_level: form.decor_level,
        photography: form.photography,
      };
      const result = await api<CostPrediction>("/ml/predict-cost", { method: "POST", body: payload });
      setPrediction(result);
      try {
        const riskResult = await api<BudgetRisk>("/ml/budget-risk", {
          method: "POST",
          body: {
            event_type: form.event_type,
            guest_count: guestCount,
            budget_cents: budgetCents,
            predicted_cost_cents: result.predicted_cost_cents,
            contingency_pct: 8,
          },
        });
        setRisk(riskResult);
      } catch {
        setRisk(null);
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "The estimate is unavailable right now.");
    } finally {
      setEstimating(false);
    }
  }

  async function create() {
    if (!validateStep(2) || !validateStep(0) || !validateStep(1)) {
      setStep(0);
      return;
    }
    setCreating(true);
    setServerError(null);
    try {
      const created = await api<EventRecord>("/events", {
        method: "POST",
        body: {
          name: form.name.trim(),
          event_type: form.event_type,
          event_date: new Date(form.event_date).toISOString(),
          city: form.city.trim(),
          location_tier: form.location_tier,
          guest_count: guestCount,
          budget_cents: budgetCents,
          currency: "USD",
          theme: form.theme,
          venue_type: form.venue_type,
          catering_level: form.catering_level,
          decor_level: form.decor_level,
          photography: form.photography,
          duration_hours: Number(form.duration_hours),
          accessibility: form.accessibility,
          notes: form.notes,
        },
      });
      router.push(`/events/${created.id}?generate=1`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) {
        setErrors(Object.fromEntries(err.fields.map((field) => [field.field, field.message])));
      }
      setServerError(err instanceof ApiError ? err.message : "The event could not be created.");
      setCreating(false);
    }
  }

  return (
    <div>
      <ol className="wizard-stepper mb-6 grid grid-cols-3 border border-line bg-[#fbf9f3]" aria-label="Event setup progress">
        {steps.map((item, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <li key={item.number} className={`wizard-step border-r border-line px-3 py-3 last:border-0 sm:px-5 ${active ? "bg-ink text-ivory" : done ? "bg-sage-soft/50" : ""}`}>
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                className="flex w-full items-center gap-3 text-left"
                aria-current={active ? "step" : undefined}
                disabled={index > step}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border text-[9.5px] ${
                    active ? "border-champagne text-champagne" : done ? "border-sage bg-sage-soft text-[#3f523a]" : "border-line text-ink-mute"
                  }`}
                >
                  {done ? <Check size={11} aria-hidden /> : item.number}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[11.5px] font-semibold uppercase tracking-[0.08em] ${active ? "text-ivory" : ""}`}>
                    {item.title}
                  </span>
                  <span className={`hidden text-[10px] sm:block ${active ? "text-[#b9b3a4]" : "text-ink-mute"}`}>{item.note}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="border border-line bg-[#fbf9f3] p-5 sm:p-6">
          {serverError ? (
            <p role="alert" className="mb-5 border-l-2 border-danger bg-[#f6e9e6] px-3 py-2 text-[12.5px] text-danger">
              {serverError}
            </p>
          ) : null}

          {step === 0 ? (
            <div className="space-y-6">
              <div>
                <p className="eyebrow text-burgundy">Step one</p>
                <h2 className="mt-1 font-display text-[28px]">What are we planning?</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">Choose an occasion, then add the date, location, guest count, and budget. An asterisk marks required fields.</p>
              </div>

              <fieldset>
                <legend className="field-label">Occasion</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EVENT_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`wizard-choice cursor-pointer border p-3 transition-colors ${
                        form.event_type === type.value ? "border-burgundy bg-[#f3e9e6]" : "border-line bg-ivory hover:border-ink-mute hover:bg-[#f5f0e5]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="event_type"
                        value={type.value}
                        checked={form.event_type === type.value}
                        onChange={() => update("event_type", type.value)}
                        className="sr-only"
                      />
                      <span className="flex items-center justify-between gap-2 text-[12.5px] font-semibold">
                        {type.label}
                        {form.event_type === type.value ? <Check size={13} className="shrink-0 text-burgundy" aria-hidden /> : null}
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-ink-soft">{type.note}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <TextField
                    id="name"
                    label="Event name"
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    error={errors.name}
                    placeholder="Amara & Theo"
                  />
                </div>
                <TextField
                  id="event_date"
                  label="Date & time"
                  type="datetime-local"
                  required
                  value={form.event_date}
                  onChange={(event) => update("event_date", event.target.value)}
                  error={errors.event_date}
                />
                <TextField
                  id="city"
                  label="City / location"
                  required
                  maxLength={120}
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  error={errors.city}
                  placeholder="Lisbon"
                />
                <TextField
                  id="guest_count"
                  label="Expected guests"
                  type="number"
                  min={1}
                  max={5000}
                  required
                  value={form.guest_count}
                  onChange={(event) => update("guest_count", event.target.value)}
                  error={errors.guest_count}
                />
                <TextField
                  id="budget"
                  label="Total budget (USD)"
                  type="number"
                  min={100}
                  step={100}
                  required
                  value={form.budget}
                  onChange={(event) => update("budget", event.target.value)}
                  error={errors.budget}
                  hint="Model estimates are USD planning ranges."
                />
                <TextField
                  id="duration_hours"
                  label="Duration (hours)"
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  required
                  value={form.duration_hours}
                  onChange={(event) => update("duration_hours", event.target.value)}
                  error={errors.duration_hours}
                />
                <SelectField
                  id="location_tier"
                  label="Location tier"
                  value={form.location_tier}
                  onChange={(event) => update("location_tier", event.target.value)}
                  hint="Affects venue and catering costs."
                >
                  {LOCATION_TIERS.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <p className="eyebrow text-burgundy">Step two</p>
                <h2 className="mt-1 font-display text-[28px]">Set the direction.</h2>
              </div>

              <fieldset>
                <legend className="field-label">Preferred theme</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {THEMES.map((theme) => (
                    <label
                      key={theme.value}
                      className={`wizard-choice flex cursor-pointer items-start gap-2.5 border p-3 transition-colors ${
                        form.theme === theme.value ? "border-burgundy bg-[#f3e9e6]" : "border-line bg-ivory hover:border-ink-mute hover:bg-[#f5f0e5]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={theme.value}
                        checked={form.theme === theme.value}
                        onChange={() => update("theme", theme.value)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${
                          form.theme === theme.value ? "border-burgundy bg-burgundy text-ivory" : "border-line"
                        }`}
                      >
                        {form.theme === theme.value ? <Check size={9} /> : null}
                      </span>
                      <span>
                        <span className="block text-[12.5px] font-semibold">{theme.label}</span>
                        <span className="mt-1 block text-[11px] leading-snug text-ink-soft">{theme.note}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  id="venue_type"
                  label="Venue category"
                  value={form.venue_type}
                  onChange={(event) => update("venue_type", event.target.value)}
                >
                  {VENUE_TYPES.map((venue) => (
                    <option key={venue.value} value={venue.value}>
                      {venue.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  id="catering_level"
                  label="Catering requirements"
                  value={form.catering_level}
                  onChange={(event) => update("catering_level", event.target.value)}
                >
                  {CATERING_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label} — {level.note}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  id="decor_level"
                  label="Decoration level"
                  value={form.decor_level}
                  onChange={(event) => update("decor_level", event.target.value)}
                >
                  {DECOR_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  id="photography"
                  label="Photography"
                  value={form.photography}
                  onChange={(event) => update("photography", event.target.value)}
                >
                  {PHOTOGRAPHY_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </SelectField>
                <div className="sm:col-span-2">
                  <TextField
                    id="accessibility"
                    label="Accessibility requirements"
                    maxLength={300}
                    value={form.accessibility}
                    onChange={(event) => update("accessibility", event.target.value)}
                    error={errors.accessibility}
                    placeholder="Step-free access, quiet room, dietary and sensory needs…"
                    hint="Shared with the planning assistant and included in the brief."
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextAreaField
                    id="notes"
                    label="Anything else?"
                    maxLength={2000}
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    error={errors.notes}
                    placeholder="Traditions, must-have moments, constraints, family logistics…"
                    hint={`${form.notes.length}/2000 characters. Treated as untrusted data by the AI assistant.`}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <p className="eyebrow text-burgundy">Step three</p>
                <h2 className="mt-1 font-display text-[28px]">Review the brief.</h2>
                <p className="mt-1.5 text-[12.5px] text-ink-soft">
                  Nothing is booked or sent to a vendor. This creates a private event in your workspace.
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {summary.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-line py-2.5">
                    <dt className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-mute">{label}</dt>
                    <dd className="text-right text-[12.5px]">{value}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-b border-line py-2.5">
                  <dt className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-mute">Per guest</dt>
                  <dd className="text-right text-[12.5px]">{perGuest ? money(perGuest) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-line py-2.5">
                  <dt className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-mute">Duration</dt>
                  <dd className="text-right text-[12.5px]">{form.duration_hours} hours</dd>
                </div>
              </dl>

              {form.accessibility || form.notes ? (
                <div className="border border-line bg-ivory p-3">
                  {form.accessibility ? (
                    <p className="text-[12px]"><span className="font-semibold">Accessibility:</span> {form.accessibility}</p>
                  ) : null}
                  {form.notes ? (
                    <p className="mt-1.5 text-[12px] text-ink-soft"><span className="font-semibold">Notes:</span> {form.notes}</p>
                  ) : null}
                </div>
              ) : null}

              {prediction ? (
                <div className="border border-ink bg-ink p-4 text-ivory">
                  <p className="eyebrow text-[9px] text-champagne">Model estimate</p>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <p className="font-display text-[42px] leading-none">{money(prediction.predicted_cost_cents)}</p>
                    {risk ? (
                      <span className="border border-champagne/50 px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-champagne">
                        {risk.risk_level} budget risk
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[11.5px] text-[#b9b3a4]">
                    {money(prediction.cost_per_guest_cents)} per guest. Planning range, not a quote.
                  </p>
                  {risk ? <p className="mt-2 text-[11px] leading-relaxed text-[#a9a396]">{risk.definition}</p> : null}
                </div>
              ) : (
                <div className="border border-dashed border-line p-4">
                  <p className="text-[12.5px] font-semibold">See the intelligence before creating.</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
                    Run the trained cost and budget-risk models on this brief. Nothing is saved.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={estimate} disabled={estimating} className="mt-3">
                    {estimating ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Sparkles size={13} aria-hidden />}
                    {estimating ? "Running models" : "Estimate this event"}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <div>
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setStep((current) => current - 1)}>
                  <ArrowLeft size={14} aria-hidden /> Back
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              {step < 2 ? (
                <Button type="button" onClick={goNext}>
                  Continue <ArrowRight size={14} aria-hidden />
                </Button>
              ) : (
                <Button type="button" variant="burgundy" onClick={create} disabled={creating}>
                  {creating ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                  {creating ? "Creating workspace" : "Create event & workspace"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="wizard-summary border border-line bg-[#fbf9f3] p-5 sm:p-6">
            <p className="eyebrow text-ink-mute">Live summary</p>
            <p className="mt-2 font-display text-[26px] leading-tight">{form.name || "Your event name"}</p>
            <p className="mt-1 text-[12.5px] font-medium text-ink-soft">
              {labelFor(EVENT_TYPES, form.event_type)}{form.city ? ` · ${form.city}` : " · Add a location"}
            </p>
            <div className="mt-4 space-y-0 border-t border-line pt-2 text-[12.5px]">
              <div className="wizard-summary-row flex justify-between gap-3"><span className="text-ink-mute">Date</span><span className="text-right">{form.event_date ? new Date(form.event_date).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Choose a date"}</span></div>
              <div className="wizard-summary-row flex justify-between gap-3"><span className="text-ink-mute">Guests</span><span>{guestCount || "Add guest count"}</span></div>
              <div className="wizard-summary-row flex justify-between gap-3"><span className="text-ink-mute">Budget</span><span>{budgetCents ? money(budgetCents) : "Add a budget"}</span></div>
              <div className="wizard-summary-row flex justify-between gap-3"><span className="text-ink-mute">Per guest</span><span>{perGuest ? money(perGuest) : "—"}</span></div>
              {step > 0 ? <>
                <div className="wizard-summary-row flex justify-between gap-3"><span className="text-ink-mute">Theme</span><span className="text-right">{titleCase(form.theme)}</span></div>
                <div className="wizard-summary-row flex justify-between gap-3"><span className="text-ink-mute">Venue</span><span className="text-right">{labelFor(VENUE_TYPES, form.venue_type)}</span></div>
                <div className="wizard-summary-row flex justify-between gap-3"><span className="text-ink-mute">Catering</span><span className="text-right">{labelFor(CATERING_LEVELS, form.catering_level)}</span></div>
              </> : null}
            </div>
            <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-mute">Updates as you edit. Nothing is saved yet.</p>
          </div>

          <div className="wizard-next border border-line bg-[#fbf9f3] p-5 sm:p-6">
            <p className="eyebrow text-ink-mute">Once it’s saved</p>
            <ul className="mt-3 space-y-3 text-[12.5px] leading-relaxed text-ink-soft">
              <li className="flex gap-2"><span className="font-mono text-[10px] text-burgundy">01</span><span>Your private event workspace is created.</span></li>
              <li className="flex gap-2"><span className="font-mono text-[10px] text-burgundy">02</span><span>You’ll see a cost estimate and budget risk check.</span></li>
              <li className="flex gap-2"><span className="font-mono text-[10px] text-burgundy">03</span><span>A draft plan and starter checklist are added for you to edit.</span></li>
            </ul>
          </div>

          <div className="wizard-limit border-l-2 border-champagne bg-[#f2eddf] px-4 py-3 text-[11.5px] leading-relaxed text-ink-soft">
            <strong className="block text-[10px] uppercase tracking-[0.14em] text-ink-soft">Planning estimate</strong>
            <p className="mt-1.5">
              Estimates are USD planning ranges from a synthetic dataset. No vendor is contacted, no availability is
              checked, and no booking is created.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
