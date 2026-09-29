import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/landing/AuthShell";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Zero Real to generate synthetic data.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/app" />
    </AuthShell>
  );
}
