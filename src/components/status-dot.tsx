import { statusDotClass, statusLabel } from "@/lib/status";

export function StatusDot({ status }: { status: string | null }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${statusDotClass(status)}`} />
      <span className="text-xs text-muted-foreground">
        {statusLabel(status)}
      </span>
    </span>
  );
}
