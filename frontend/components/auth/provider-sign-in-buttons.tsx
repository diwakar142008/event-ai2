"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/client";

type Provider = "google" | "facebook" | "microsoft";
type ProviderStatus = Record<Provider, { enabled: boolean }>;

const providers: { id: Provider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "microsoft", label: "Microsoft" },
];

const oauthMessages: Record<string, string> = {
  provider_unavailable: "That sign-in option is not configured yet. Use your email or try another provider.",
  invalid_state: "That sign-in request expired or could not be verified. Please try again.",
  cancelled: "Sign-in was cancelled. You can try again whenever you’re ready.",
  provider_error: "The provider could not complete sign-in. Please try again.",
  email_required: "The provider did not share a valid email address. Allow email access and try again.",
  account_conflict: "An account with this email already exists. Sign in with your existing method first.",
  account_unavailable: "This account is unavailable. Contact the workspace administrator.",
};

function ProviderLogo({ provider }: { provider: Provider }) {
  if (provider === "google") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px]">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.91c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.36 38.08 46.98 31.92 46.98 24.55Z" />
        <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.54 2.56 10.78l7.97-6.19Z" transform="translate(0 4)" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
      </svg>
    );
  }
  if (provider === "facebook") {
    return (
      <span aria-hidden="true" className="flex h-[18px] w-[18px] items-end justify-center overflow-hidden rounded-full bg-[#1877F2] text-[17px] font-bold leading-[17px] text-white">
        f
      </span>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

export function ProviderSignInButtons({
  returnTo,
}: {
  returnTo: "sign-in" | "sign-up";
}) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void api<{ providers: ProviderStatus }>("/auth/oauth/providers", {
      signal: controller.signal,
    })
      .then((result) => setStatus(result.providers))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof ApiError
            ? error.message
            : "Sign-in providers are temporarily unavailable.",
        );
      });

    const code = new URLSearchParams(window.location.search).get("oauth_error");
    if (code) setOauthError(oauthMessages[code] ?? oauthMessages.provider_error);
    return () => controller.abort();
  }, []);

  return (
    <div className="auth-provider-section">
      <div className="auth-provider-grid">
        {providers.map(({ id, label }) => {
          const enabled = status?.[id]?.enabled ?? false;
          return (
            <button
              key={id}
              type="button"
              className="auth-provider-button"
              disabled={!enabled}
              onClick={() => {
                window.location.assign(
                  `/api/backend/auth/oauth/${id}?return_to=${returnTo}`,
                );
              }}
              aria-label={
                enabled
                  ? `Continue with ${label}`
                  : `${label} sign-in is not configured`
              }
            >
              <ProviderLogo provider={id} />
              <span>Continue with {label}</span>
              {!enabled ? <span className="auth-provider-configure">{status ? "Not set up" : "Checking"}</span> : null}
            </button>
          );
        })}
      </div>
      {status && !Object.values(status).some(({ enabled }) => enabled) ? (
        <p className="auth-provider-note">
          Provider sign-in appears here when OAuth credentials are configured.
        </p>
      ) : null}
      {loadError ? <p className="auth-message auth-message-error" role="alert">{loadError}</p> : null}
      {oauthError ? <p className="auth-message auth-message-error" role="alert">{oauthError}</p> : null}
    </div>
  );
}
