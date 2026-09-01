"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const TEAM_SIZES: { value: string; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "2-5", label: "2 à 5 personnes" },
  { value: "6-20", label: "6 à 20 personnes" },
  { value: "20+", label: "20 personnes et plus" },
];

export function TeamSizeSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <Select key={defaultValue} name="team_size" defaultValue={defaultValue}>
      <SelectTrigger id="team_size">
        <SelectValue placeholder="Non précisé">
          {(value: string) =>
            TEAM_SIZES.find((s) => s.value === value)?.label ?? "Non précisé"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Non précisé</SelectItem>
        {TEAM_SIZES.map((size) => (
          <SelectItem key={size.value} value={size.value}>
            {size.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
