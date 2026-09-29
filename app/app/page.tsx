import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/Workspace";

export const metadata: Metadata = {
  title: "App",
  description:
    "Generate realistic, privacy-safe tabular, relational and document data in your browser. Seeded, validated and exportable to CSV, JSON, SQL and printable documents.",
};

export default function AppPage() {
  return <Workspace />;
}
