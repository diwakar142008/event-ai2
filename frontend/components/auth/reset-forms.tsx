"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client";

type ResetResponse = { message: string; dev_reset_token?: string; dev_notice?: string };

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<ResetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await api<ResetResponse>("/auth/password-reset/request", { method: "POST", body: { email } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The reset request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="border-l-2 border-sage bg-sage-soft/50 px-3 py-2.5 text-[12.5px] leading-relaxed">{result.message}</p>
        {result.dev_reset_token ? (
          <div className="border border-line bg-[#fbf9f3] p-4">
            <p className="eyebrow text-[9px] text-warn">Development only</p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">{result.dev_notice}</p>
            <Link
              href={`/reset-password?token=${encodeURIComponent(result.dev_reset_token)}`}
              className="mt-3 inline-block break-all font-mono text-[11px] text-burgundy underline"
            >
              Open reset link
            </Link>
          </div>
        ) : null}
        <Link href="/sign-in" className="inline-block text-[12.5px] font-semibold uppercase tracking-[0.1em] text-burgundy">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        id="reset-email"
        label="Account email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@studio.com"
      />
      {error ? <p role="alert" className="text-[12.5px] text-danger">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {loading ? "Requesting" : "Request a reset"}
      </Button>
      <p className="text-[11px] leading-relaxed text-ink-mute">
        No email provider is configured in this deployment. In development the reset token is returned once so
        the flow is testable; in production configure delivery and disable the echo.
      </p>
    </form>
  );
}

export function ResetPasswordForm({ initialToken = "" }: { initialToken?: string }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await api("/auth/password-reset/confirm", { method: "POST", body: { token, new_password: password } });
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 1600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The reset failed. Request a new link.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="border-l-2 border-sage bg-sage-soft/50 px-3 py-2.5 text-[12.5px]">Password updated. Redirecting to sign in…</p>
        <Link href="/sign-in" className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-burgundy">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        id="token"
        label="Reset token"
        required
        value={token}
        onChange={(event) => setToken(event.target.value)}
        hint="Paste the token from your reset link."
      />
      <TextField
        id="new-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint="At least 10 characters with letters and numbers."
      />
      <TextField
        id="confirm-password"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />
      {error ? <p role="alert" className="text-[12.5px] text-danger">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {loading ? "Updating" : "Set new password"}
      </Button>
    </form>
  );
}
