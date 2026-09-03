import { cn } from "@/lib/utils";

// Feedback fix: "a text field with a Save button floating to the right"
// read as two disconnected, flat controls. This joins them into a single
// pill — the input's own border/ring are cancelled by the caller
// (rounded-none border-0 ... focus-visible:ring-0) so only this
// container's has-[:focus-visible] ring shows, and a hairline divider
// (not a second border) separates the action segment from the field.
export function FieldRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-2xl border border-input bg-transparent transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 dark:bg-input/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FieldRowDivider() {
  return <div className="w-px shrink-0 self-stretch bg-input" aria-hidden="true" />;
}
