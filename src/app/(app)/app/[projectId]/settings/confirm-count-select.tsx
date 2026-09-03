"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CONFIRM_COUNTS = [
  { value: "1", label: "1 échec" },
  { value: "2", label: "2 échecs d'affilée" },
  { value: "3", label: "3 échecs d'affilée" },
];

export function ConfirmCountSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <Select key={defaultValue} name="alert_confirm_count" defaultValue={defaultValue}>
      <SelectTrigger id="alert_confirm_count">
        <SelectValue>
          {(value: string) =>
            `Alerter après ${CONFIRM_COUNTS.find((c) => c.value === value)?.label ?? "1 échec"}`
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CONFIRM_COUNTS.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            Alerter après {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
