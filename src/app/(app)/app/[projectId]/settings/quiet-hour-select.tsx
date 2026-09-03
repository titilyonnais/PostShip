"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h));

export function QuietHourSelect({
  name,
  defaultValue,
  label,
}: {
  name: "quiet_hours_start" | "quiet_hours_end";
  defaultValue: string;
  label: string;
}) {
  return (
    <Select key={defaultValue} name={name} defaultValue={defaultValue}>
      <SelectTrigger id={name} aria-label={label}>
        <SelectValue placeholder="Désactivé">
          {(value: string) => (value === "" ? "Désactivé" : `${value}h`)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Désactivé</SelectItem>
        {HOURS.map((h) => (
          <SelectItem key={h} value={h}>
            {h}h
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
