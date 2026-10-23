"use client";

import { Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client";
import { formatDate } from "@/lib/format";
import type { AIStatus, ConfigStatus, MLMetrics, User } from "@/lib/types";

export function SettingsClient({
  user,
  config,
  aiStatus,
  metrics,
}: {
  user: User;
  config: ConfigStatus | null;
  aiStatus: AIStatus | null;
  metrics: MLMetrics | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeBusy, setWipeBusy] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isProduction = config?.environment === "production";

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await api<User>("/auth/profile", { method: "PATCH", body: { display_name: displayName.trim() } });
      setProfileMessage("Profile updated.");
      router.refresh();
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Profile update failed.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function wipeEvents() {
    if (wipeConfirm !== "DELETE EVENTS") {
      setWipeError('Type "DELETE EVENTS" exactly to confirm.');
      return;
    }
    setWipeBusy(true);
    setWipeError(null);
    try {
      await api("/account/data", { method: "DELETE" });
      setWipeOpen(false);
      setWipeConfirm("");
      router.refresh();
    } catch (err) {
      setWipeError(err instanceof ApiError ? err.message : "Event data could not be deleted.");
    } finally {
      setWipeBusy(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== "DELETE") {
      setDeleteError('Type "DELETE" exactly to confirm.');
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api("/auth/account", { method: "DELETE", body: { password: deletePassword, confirmation: "DELETE" } });
      router.push("/");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Account deletion failed.");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        <section className="border border-line bg-[#fbf9f3]">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Account</p>
            <h2 className="mt-0.5 font-display text-[22px]">Your profile</h2>
          </div>
          <form onSubmit={saveProfile} className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="display-name"
                label="Display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                required
              />
              <div>
                <p className="field-label">Email</p>
                <p className="flex min-h-[46px] items-center border border-line bg-ivory px-3 text-[13px] text-ink-mute">{user.email}</p>
                <p className="field-hint">Email changes are not supported in this deployment.</p>
              </div>
            </div>
            {profileError ? <p role="alert" className="text-[12px] text-danger">{profileError}</p> : null}
            {profileMessage ? <p role="status" aria-live="polite" className="text-[12px] text-[#3f523a]">{profileMessage}</p> : null}
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10.5px] text-ink-mute">Member since {formatDate(user.created_at)}</p>
              <Button type="submit" size="sm" disabled={profileBusy || displayName.trim().length < 2}>
                {profileBusy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                {profileBusy ? "Saving" : "Save profile"}
              </Button>
            </div>
          </form>
          <div className="border-t border-line px-4 py-3">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-soft">
              <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0 text-burgundy" />
              {config?.auth_mode ?? "Self-hosted sessions with Argon2id hashing and HttpOnly cookies."} Sessions expire
              after seven days; signing out revokes the current session, and a password reset revokes all sessions.
            </p>
          </div>
        </section>

        <section className="border border-line bg-[#fbf9f3]">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Privacy &amp; data</p>
            <h2 className="mt-0.5 font-display text-[22px]">Your records</h2>
          </div>
          <div className="space-y-4 p-4">
            <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[12.5px] font-semibold">Export your data</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-mute">
                  Download account and event records as JSON. Per-event plans, tasks, expenses, and notes are available from each workspace.
                </p>
              </div>
              <a href="/api/backend/account/export" className="btn btn-outline min-h-[36px] shrink-0 px-3 text-[10px]" download>
                <Download size={13} aria-hidden /> Download
              </a>
            </div>

            <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[12.5px] font-semibold">Delete all event data</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-mute">
                  Removes every event, plan, task, expense, and note. Your account stays active. This cannot be undone.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setWipeOpen((value) => !value)} className="shrink-0">
                <Trash2 size={13} aria-hidden /> Delete events
              </Button>
            </div>
            {wipeOpen ? (
              <div className="border border-[#d3a09c] bg-[#f6e4e1]/60 p-3">
                <label htmlFor="wipe-confirm" className="field-label">Type DELETE EVENTS</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="wipe-confirm"
                    value={wipeConfirm}
                    onChange={(event) => setWipeConfirm(event.target.value)}
                    className="field-input"
                    autoComplete="off"
                  />
                  <Button type="button" variant="burgundy" size="sm" onClick={wipeEvents} disabled={wipeBusy || wipeConfirm !== "DELETE EVENTS"}>
                    {wipeBusy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                    {wipeBusy ? "Deleting" : "Confirm delete"}
                  </Button>
                </div>
                {wipeError ? <p role="alert" className="mt-2 text-[11.5px] text-danger">{wipeError}</p> : null}
              </div>
            ) : null}

            <div>
              <p className="text-[12.5px] font-semibold text-danger">Delete account</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-mute">
                Permanently removes the account and all owned records. Password confirmation is required.
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteOpen((value) => !value)} className="mt-2 !text-danger">
                Delete my account
              </Button>
              {deleteOpen ? (
                <div className="mt-2 space-y-2 border border-[#d3a09c] bg-[#f6e4e1]/60 p-3">
                  <TextField
                    id="delete-password"
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                  />
                  <TextField
                    id="delete-confirm"
                    label='Type "DELETE"'
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                    autoComplete="off"
                  />
                  {deleteError ? <p role="alert" className="text-[11.5px] text-danger">{deleteError}</p> : null}
                  <Button
                    type="button"
                    variant="burgundy"
                    size="sm"
                    onClick={deleteAccount}
                    disabled={deleteBusy || !deletePassword || deleteConfirm !== "DELETE"}
                  >
                    {deleteBusy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Trash2 size={12} aria-hidden />}
                    {deleteBusy ? "Deleting account" : "Permanently delete account"}
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="border-t border-line pt-3 text-[10px] leading-relaxed text-ink-mute">
              Event plans are excluded from search indexing. AI conversations are not stored server-side. Event notes are
              sent to the AI provider only when you use the assistant or generate a plan.
            </p>
          </div>
        </section>
      </div>

      <div className="space-y-5">
        <section className="settings-config-panel border border-ink bg-ink p-4 text-ivory">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-champagne">Configuration</p>
            <span className="label-chip border-line-dark text-[9.5px] text-[#e4dccb]">
              {isProduction ? "Production" : "Local / development"}
            </span>
          </div>
          <h2 className="mt-2 font-display text-[24px]">Planning tools</h2>
          <div className="mt-4 space-y-2.5 text-[11.5px]">
            <div className="flex justify-between gap-3 border-b border-line-dark pb-2">
              <span className="text-[#d5cdbd]">AI provider</span>
              <span>{aiStatus?.configured ? aiStatus.provider : "Not configured"}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-line-dark pb-2">
              <span className="text-[#d5cdbd]">Model</span>
              <span className="max-w-[55%] truncate text-right">{aiStatus?.model ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-line-dark pb-2">
              <span className="text-[#d5cdbd]">Fallback</span>
              <span className="text-right">{aiStatus?.fallback_available ? "Available" : "None"}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-line-dark pb-2">
              <span className="text-[#d5cdbd]">Plan format</span>
              <span>{aiStatus?.structured_output_schema ?? "event_plan.v1"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#d5cdbd]">Token ceiling</span>
              <span>{aiStatus?.max_output_tokens?.toLocaleString() ?? "—"}</span>
            </div>
          </div>
          <p className="mt-4 border-t border-line-dark pt-3 text-[11px] leading-relaxed text-[#d5cdbd]">
            {aiStatus?.configured
              ? "The provider key is stored server-side only. Settings displays status, never the key."
              : "Without a provider key, plans and replies come from the deterministic local planner and say so. Add a provider credential on the server to enable the provider."}
          </p>
        </section>

        <section className="border border-line bg-[#fbf9f3] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Estimates</p>
          <h2 className="mt-0.5 font-display text-[22px]">Estimate model status</h2>
          <ul className="mt-3 space-y-2">
            {[
              ["Cost estimate", metrics?.trained.cost, metrics?.cost ? `Typical error $${Math.round(metrics.cost.metrics.mae_usd).toLocaleString()} · fit ${metrics.cost.metrics.r2}` : "Unavailable"],
              ["Idea matching", metrics?.trained.recommender, metrics?.recommender ? `${metrics.recommender.catalogue_size} ideas available` : "Unavailable"],
              ["Budget risk check", metrics?.trained.budget_risk, metrics?.budget_risk ? `Accuracy ${metrics.budget_risk.metrics.accuracy}` : "Unavailable"],
            ].map(([label, trained, detail]) => (
              <li key={String(label)} className="flex items-start justify-between gap-3 border-b border-line/70 pb-2 text-[11.5px] last:border-0">
                <div>
                  <p>{label}</p>
                  <p className="text-[9.5px] text-ink-mute">{detail}</p>
                </div>
                <span className={`shrink-0 border px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em] ${trained ? "border-sage bg-sage-soft text-[#3f523a]" : "border-[#d9c58f] bg-[#f6eed7] text-[#715620]"}`}>
                  {trained ? "Ready" : "Missing"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-mute">
            Cost and risk models are trained on synthetic data. Metrics measure recovery of documented generator
            assumptions, not market accuracy. AI status is honest about configuration; secrets are never shown.
          </p>
        </section>

        <section className="border border-line p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Workspace information</p>
          <h2 className="mt-0.5 font-display text-[22px]">Environment</h2>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
            {isProduction
              ? "This instance reports a production environment. Secure cookies and HSTS are expected; verify HTTPS termination and the origin allowlist."
              : "This instance is running a local/development configuration. Password-reset tokens may be echoed for testing, cookies are not forced secure, and the self-hosted auth profile is not a substitute for a managed identity provider in production."}
          </p>
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-mute">
            Currency is fixed to USD for model coherence. No FX conversion is performed.
          </p>
        </section>
      </div>
    </div>
  );
}
