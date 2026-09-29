import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/landing/AuthShell";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a Zero Real account to generate synthetic data.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/app" />
    </AuthShell>
  );
}
