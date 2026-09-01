"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LocaleSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <Select key={defaultValue} name="locale" defaultValue={defaultValue}>
      <SelectTrigger id="locale">
        <SelectValue>
          {(value: string) => (value === "en" ? "English" : "Français")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="fr">Français</SelectItem>
        <SelectItem value="en">English</SelectItem>
      </SelectContent>
    </Select>
  );
}
