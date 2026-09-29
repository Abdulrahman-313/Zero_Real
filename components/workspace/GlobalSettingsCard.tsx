"use client";

import type { ReactNode } from "react";
import { Button, Card, NumberField, SelectField } from "@/components/ui/controls";
import { DiceIcon } from "@/components/ui/icons";
import {
  CURRENCIES,
  CURRENCY_CODES,
  LOCALE_IDS,
  LOCALES,
  MAX_SEED,
  type GlobalSettings,
} from "@/lib/engines/shared/locales";

const localeOptions = LOCALE_IDS.map((id) => ({ value: id, label: LOCALES[id].label }));
const currencyOptions = CURRENCY_CODES.map((code) => ({ value: code, label: CURRENCIES[code].label }));

export function GlobalSettingsCard({
  settings,
  onChange,
  countField,
}: {
  settings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
  /** Mode-specific size control (row count, customer count, document count). */
  countField?: ReactNode;
}) {
  return (
    <Card title="Generation" description="Same seed and settings always produce the same data.">
      <div className="space-y-3">
        {countField}
        <div className="flex items-end gap-2">
          <NumberField
            className="flex-1"
            label="Random seed"
            value={settings.seed}
            min={0}
            max={MAX_SEED}
            onChange={(seed) => onChange({ ...settings, seed })}
          />
          <Button
            variant="secondary"
            size="icon"
            className="mb-px h-[34px] w-[34px]"
            aria-label="Randomize seed"
            title="Randomize seed"
            onClick={() => onChange({ ...settings, seed: Math.floor(Math.random() * 1_000_000) })}
          >
            <DiceIcon width={18} height={18} />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <SelectField
            label="Locale"
            value={settings.locale}
            options={localeOptions}
            onChange={(locale) =>
              onChange({ ...settings, locale, currency: LOCALES[locale].defaultCurrency })
            }
          />
          <SelectField
            label="Currency"
            value={settings.currency}
            options={currencyOptions}
            onChange={(currency) => onChange({ ...settings, currency })}
          />
        </div>
      </div>
    </Card>
  );
}
