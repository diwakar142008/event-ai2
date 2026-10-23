import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <AuthShell
      mode="sign-up"
      eyebrow="Your next occasion starts here"
      title={<>Make room for <span className="display-italic">the good.</span></>}
      subtitle="Create your private workspace and bring every celebration from first idea to final detail."
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
