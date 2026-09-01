import { cn } from "@/lib/utils";

// The brand mark: a rounded badge with a checkmark cut out of it — this is a
// monitoring product, so "verified" is the one idea worth spending the logo
// on. Kept neutral (light badge, dark mark) rather than status-green so it
// reads as a stable brand, not a permanent "all clear".
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-[0.4em] bg-foreground",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[0.6em]" fill="none">
        <path
          d="M5 12.5L10 17.5L19 7"
          stroke="var(--background)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-[1.6em] text-[0.7rem]" />
      {!iconOnly && (
        <span className="font-mono text-sm font-medium tracking-tight text-foreground">
          PostShip
        </span>
      )}
    </span>
  );
}
