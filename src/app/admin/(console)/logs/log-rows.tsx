"use client";

import { Fragment, useState } from "react";
import type { OpsEventRow } from "@/lib/ops-events";

const SEVERITY_CLASS: Record<string, string> = {
  info: "border-neutral-800 text-neutral-400",
  warn: "border-[#d29922]/40 text-[#d29922]",
  error: "border-[#f85149]/40 text-[#f85149]",
  fraud: "border-[#f85149] text-[#f85149]",
};

// Only fraud gets a row background. If warn and error tinted too, the
// journal would be a wall of colour and the one severity that means "look
// at this now" would stop standing out.
const ROW_CLASS: Record<string, string> = {
  fraud: "bg-[#f85149]/10",
};

export function LogRows({ rows }: { rows: OpsEventRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center font-mono text-xs text-neutral-600">
        Aucun événement sur ces filtres.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-neutral-900">
            {["Quand", "Source", "Gravité", "Action", "Cible", "IP"].map((h) => (
              <th
                key={h}
                className="px-2 py-2 text-left text-[0.65rem] tracking-wide text-neutral-600 uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = open === row.id;
            return (
              <Fragment key={row.id}>
                <tr
                  onClick={() => setOpen(expanded ? null : row.id)}
                  className={`cursor-pointer border-b border-neutral-900/60 hover:bg-neutral-900/40 ${ROW_CLASS[row.severity] ?? ""}`}
                >
                  <td className="px-2 py-2 whitespace-nowrap text-neutral-500">
                    {new Date(row.at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-2 py-2 text-neutral-400">{row.source}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-block border px-1.5 py-0.5 text-[0.65rem] ${SEVERITY_CLASS[row.severity] ?? SEVERITY_CLASS.info}`}
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-neutral-200">{row.action}</td>
                  <td className="max-w-[220px] truncate px-2 py-2 text-neutral-400">
                    {row.target ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-neutral-600">{row.ip ?? "—"}</td>
                </tr>
                {expanded && (
                  <tr className="border-b border-neutral-900/60">
                    <td colSpan={6} className="px-2 py-3">
                      {/* A <pre>, not a modal library: the payload is JSON
                          and the only thing anyone wants to do with it is
                          read it and copy part of it. */}
                      <pre className="overflow-x-auto bg-[#08090b] p-3 text-[0.7rem] leading-relaxed text-neutral-400">
                        {JSON.stringify(row.payload, null, 2)}
                      </pre>
                      {row.user_agent && (
                        <p className="mt-2 break-all text-[0.65rem] text-neutral-600">
                          {row.user_agent}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
