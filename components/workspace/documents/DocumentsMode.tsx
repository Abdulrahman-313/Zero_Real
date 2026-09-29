"use client";

import { Card } from "@/components/ui/controls";
import { ExportMenu } from "../ExportMenu";
import { GlobalSettingsCard } from "../GlobalSettingsCard";
import { ModeLayout } from "../ModeLayout";
import { MODES, type ModeProps } from "../modes";

const meta = MODES.find((m) => m.id === "documents")!;

export function DocumentsMode({ settings, onSettingsChange }: ModeProps) {
  return (
    <ModeLayout
      mode={meta.id}
      title={meta.title}
      summary={meta.summary}
      preview={
        <Card title="Preview">
          <p className="text-sm text-muted">The documents generator is not available yet.</p>
        </Card>
      }
      config={<GlobalSettingsCard settings={settings} onChange={onSettingsChange} />}
      exportBar={<ExportMenu options={[]} disabled disabledReason="Nothing to export yet." />}
    />
  );
}
