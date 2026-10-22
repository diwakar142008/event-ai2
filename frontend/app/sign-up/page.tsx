import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Open the atelier"
      title={<>Start with a <span className="display-italic">brief.</span></>}
      subtitle="Create a private workspace. Your events, plans, and notes are visible only to your account."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-burgundy hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
