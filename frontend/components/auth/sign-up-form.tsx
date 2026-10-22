"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client";
import type { AuthSession } from "@/lib/types";

export function SignUpForm() {
  const router = useRouter();
  const [form, setForm] = useState({ display_name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.display_name.trim().length < 2) next.display_name = "Tell us what to call you.";
    if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 10) next.password = "Use at least 10 characters.";
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      next.password = "Include at least one letter and one number.";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await api<AuthSession>("/auth/signup", {
        method: "POST",
        body: { display_name: form.display_name.trim(), email: form.email, password: form.password },
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) {
        setErrors(Object.fromEntries(err.fields.map((field) => [field.field, field.message])));
      }
      setError(err instanceof ApiError ? err.message : "Account creation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        id="display_name"
        label="Name"
        autoComplete="name"
        required
        value={form.display_name}
        onChange={(event) => setForm({ ...form, display_name: event.target.value })}
        error={errors.display_name}
        placeholder="Ava Marchetti"
      />
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
        error={errors.email}
        placeholder="you@studio.com"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          error={errors.password}
          hint="10+ characters, letters and numbers."
        />
        <TextField
          id="confirm"
          label="Confirm"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={(event) => setForm({ ...form, confirm: event.target.value })}
          error={errors.confirm}
        />
      </div>
      {error ? (
        <p role="alert" className="border-l-2 border-danger bg-[#f6e9e6] px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {loading ? "Creating account" : "Create your studio account"}
      </Button>
      <p className="text-[11px] leading-relaxed text-ink-mute">
        By creating an account you agree that event planning data you enter is stored for this application.
        You can export or delete it at any time from Settings.
      </p>
    </form>
  );
}
