export const STATUS_LABEL: Record<string, string> = {
  pass: "OK",
  fail: "En échec",
  error: "Erreur",
  pending: "En attente",
};

export const STATUS_DOT_CLASS: Record<string, string> = {
  pass: "bg-emerald-500",
  fail: "bg-red-500",
  error: "bg-amber-500",
  pending: "bg-neutral-500",
};

export function statusLabel(status: string | null): string {
  return STATUS_LABEL[status ?? "pending"] ?? (status ?? "—");
}

export function statusDotClass(status: string | null): string {
  return STATUS_DOT_CLASS[status ?? "pending"] ?? STATUS_DOT_CLASS.pending;
}
