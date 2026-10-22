"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client";
import {
  CATERING_LEVELS,
  DECOR_LEVELS,
  EVENT_TYPES,
  LOCATION_TIERS,
  PHOTOGRAPHY_LEVELS,
  THEMES,
  VENUE_TYPES,
} from "@/lib/options";
import type { EventRecord } from "@/lib/types";

function toLocalInput(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function BriefEditor({
  event,
  onClose,
  onSaved,
}: {
  event: EventRecord;
  onClose: () => void;
  onSaved: (event: EventRecord) => void;
}) {
  const [form, setForm] = useState({
    name: event.name,
    event_type: event.event_type,
    event_date: toLocalInput(event.event_date),
    city: event.city,
    location_tier: event.location_tier,
    guest_count: String(event.guest_count),
    budget: String(event.budget_cents / 100),
    duration_hours: String(event.duration_hours ?? 5),
    theme: event.theme,
    venue_type: event.venue_type,
    catering_level: event.catering_level,
    decor_level: event.decor_level,
    photography: event.photography,
    accessibility: event.accessibility,
    notes: event.notes,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event_: React.FormEvent<HTMLFormElement>) {
    event_.preventDefault();
    setError(null);
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Name is too short.";
    if (form.city.trim().length < 2) next.city = "Enter a city.";
    const guests = Number(form.guest_count);
    if (!Number.isInteger(guests) || guests < 1 || guests > 5000) next.guest_count = "1–5,000 guests.";
    const cents = Math.round(Number(form.budget) * 100);
    if (!Number.isFinite(cents) || cents < 10_000) next.budget = "Minimum budget is $100.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const updated = await api<EventRecord>(`/events/${event.id}`, {
        method: "PUT",
        body: {
          name: form.name.trim(),
          event_type: form.event_type,
          event_date: new Date(form.event_date).toISOString(),
          city: form.city.trim(),
          location_tier: form.location_tier,
          guest_count: guests,
          budget_cents: cents,
          duration_hours: Number(form.duration_hours),
          theme: form.theme,
          venue_type: form.venue_type,
          catering_level: form.catering_level,
          decor_level: form.decor_level,
          photography: form.photography,
          accessibility: form.accessibility,
          notes: form.notes,
        },
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) {
        setErrors(Object.fromEntries(err.fields.map((field) => [field.field, field.message])));
      }
      setError(err instanceof ApiError ? err.message : "The brief could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brief-editor-title"
        className="relative w-full max-w-[760px] border border-line bg-ivory shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ivory px-5 py-4">
          <div>
            <p className="eyebrow text-[9px] text-burgundy">Edit requirements</p>
            <h2 id="brief-editor-title" className="mt-0.5 font-display text-[25px]">The brief</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor" className="flex h-8 w-8 items-center justify-center border border-line">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={save} className="space-y-4 p-5" noValidate>
          {error ? (
            <p role="alert" className="border-l-2 border-danger bg-[#f6e9e6] px-3 py-2 text-[12.5px] text-danger">{error}</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField id="edit-name" label="Event name" value={form.name} maxLength={120} onChange={(e) => update("name", e.target.value)} error={errors.name} />
            </div>
            <SelectField id="edit-type" label="Occasion" value={form.event_type} onChange={(e) => update("event_type", e.target.value)}>
              {EVENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <TextField id="edit-date" label="Date & time" type="datetime-local" value={form.event_date} onChange={(e) => update("event_date", e.target.value)} error={errors.event_date} />
            <TextField id="edit-city" label="City" value={form.city} maxLength={120} onChange={(e) => update("city", e.target.value)} error={errors.city} />
            <SelectField id="edit-tier" label="Location tier" value={form.location_tier} onChange={(e) => update("location_tier", e.target.value)}>
              {LOCATION_TIERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <TextField id="edit-guests" label="Guests" type="number" min={1} max={5000} value={form.guest_count} onChange={(e) => update("guest_count", e.target.value)} error={errors.guest_count} />
            <TextField id="edit-budget" label="Budget (USD)" type="number" min={100} step={100} value={form.budget} onChange={(e) => update("budget", e.target.value)} error={errors.budget} />
            <TextField id="edit-duration" label="Duration (hours)" type="number" min={1} max={24} step={0.5} value={form.duration_hours} onChange={(e) => update("duration_hours", e.target.value)} />
            <SelectField id="edit-theme" label="Theme" value={form.theme} onChange={(e) => update("theme", e.target.value)}>
              {THEMES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField id="edit-venue" label="Venue" value={form.venue_type} onChange={(e) => update("venue_type", e.target.value)}>
              {VENUE_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField id="edit-catering" label="Catering" value={form.catering_level} onChange={(e) => update("catering_level", e.target.value)}>
              {CATERING_LEVELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField id="edit-decor" label="Decoration" value={form.decor_level} onChange={(e) => update("decor_level", e.target.value)}>
              {DECOR_LEVELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField id="edit-photo" label="Photography" value={form.photography} onChange={(e) => update("photography", e.target.value)}>
              {PHOTOGRAPHY_LEVELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <div className="sm:col-span-2">
              <TextField id="edit-access" label="Accessibility" value={form.accessibility} maxLength={300} onChange={(e) => update("accessibility", e.target.value)} hint="Included in the brief and shared with the assistant." />
            </div>
            <div className="sm:col-span-2">
              <TextAreaField id="edit-notes" label="Notes" value={form.notes} maxLength={2000} onChange={(e) => update("notes", e.target.value)} hint={`${form.notes.length}/2000`} />
            </div>
          </div>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-ivory py-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
              {saving ? "Saving" : "Save changes"}
            </Button>
          </div>
          <p className="text-[10.5px] text-ink-mute">
            Saving re-runs cost and budget-risk inference when planning fields change.
          </p>
        </form>
      </div>
    </div>
  );
}
