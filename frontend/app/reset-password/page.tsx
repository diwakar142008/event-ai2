import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-forms";

export const metadata: Metadata = { title: "Set new password", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell
      mode="sign-in"
      eyebrow="Account recovery"
      title={<>Choose a new <span className="display-italic">password.</span></>}
      subtitle="This invalidates every existing session for the account."
    >
      <ResetPasswordForm initialToken={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
