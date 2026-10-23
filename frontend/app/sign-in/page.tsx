import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <AuthShell
      mode="sign-in"
      eyebrow="Pick up where you left off"
      title={<>Welcome <span className="display-italic">back.</span></>}
      subtitle="Your event plans, saved details, and next steps are right where you left them."
      footer={
        <div className="flex flex-wrap justify-between gap-3">
          <p>
            New here?{" "}
            <Link href="/sign-up" className="font-semibold text-burgundy hover:underline">
              Create an account
            </Link>
          </p>
          <Link href="/forgot-password" className="hover:text-burgundy hover:underline">
            Forgot password?
          </Link>
        </div>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
