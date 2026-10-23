import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/reset-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      mode="sign-in"
      eyebrow="Account recovery"
      title={<>Reset the <span className="display-italic">key.</span></>}
      subtitle="Request a single-use reset token. The response is identical whether or not the address is registered."
      footer={
        <Link href="/sign-in" className="font-semibold text-burgundy hover:underline">
          Return to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
