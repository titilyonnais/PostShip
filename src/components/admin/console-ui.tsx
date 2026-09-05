import type { ReactNode } from "react";

// A denser, flatter vocabulary than the customer app on purpose: mono
// everywhere, hairline borders, no rounded cards. Someone glancing at a
// screenshot should never have to ask which of the two they are looking at.

export function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-neutral-900 bg-[#0b0d10]">
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-neutral-900 px-4 py-2">
          {title && (
            <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-[#3fb950]"
      : tone === "warn"
        ? "text-[#d29922]"
        : tone === "bad"
          ? "text-[#f85149]"
          : "text-neutral-100";

  return (
    <div className="border border-neutral-900 bg-[#0b0d10] px-4 py-3">
      <p className="font-mono text-[0.65rem] tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className={`mt-1 font-mono text-xl ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 font-mono text-[0.65rem] text-neutral-600">{hint}</p>}
    </div>
  );
}

export function Table({
  head,
  children,
  empty,
}: {
  head: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return (
      <p className="py-6 text-center font-mono text-xs text-neutral-600">Aucune donnée.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-neutral-900">
            {head.map((cell) => (
              <th
                key={cell}
                className="px-2 py-2 text-left text-[0.65rem] tracking-wide text-neutral-600 uppercase"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-b border-neutral-900/60 hover:bg-neutral-900/40">{children}</tr>;
}

export function Cell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-2 py-2 align-top text-neutral-300 ${className}`}>{children}</td>;
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "border-[#3fb950]/40 text-[#3fb950]"
      : tone === "warn"
        ? "border-[#d29922]/40 text-[#d29922]"
        : tone === "bad"
          ? "border-[#f85149]/40 text-[#f85149]"
          : "border-neutral-800 text-neutral-400";

  return (
    <span className={`inline-block border px-1.5 py-0.5 text-[0.65rem] ${toneClass}`}>
      {children}
    </span>
  );
}
