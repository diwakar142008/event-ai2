"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ProviderSignInButtons } from "@/components/auth/provider-sign-in-buttons";
import { api, ApiError } from "@/lib/client";
import type { AuthSession } from "@/lib/types";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api<AuthSession>("/auth/signin", { method: "POST", body: { email, password } });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <ProviderSignInButtons returnTo="sign-in" />
      <div className="auth-divider"><span>or sign in with email</span></div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
        />
        {error ? (
          <p role="alert" className="border-l-2 border-danger bg-[#f6e9e6] px-3 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="auth-submit-button w-full">
          {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
          {loading ? "Signing in" : "Sign in to your workspace"}
        </Button>
        <p className="auth-form-assurance">Your saved events and plans are protected by secure, private sessions.</p>
      </form>
    </div>
  );
}
