"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function offsetLabel(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return offset ? `${zone} (${offset})` : zone;
  } catch {
    return zone;
  }
}

export function TimezoneSelect({ defaultValue }: { defaultValue: string }) {
  const zones = useMemo(() => {
    const names =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [defaultValue || "Europe/Paris"];
    return names.map((zone) => ({ value: zone, label: offsetLabel(zone) }));
  }, [defaultValue]);

  return (
    <Select key={defaultValue} name="timezone" defaultValue={defaultValue}>
      <SelectTrigger id="timezone">
        <SelectValue placeholder="Europe/Paris">
          {(value: string) => zones.find((z) => z.value === value)?.label ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {zones.map((zone) => (
          <SelectItem key={zone.value} value={zone.value}>
            {zone.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
