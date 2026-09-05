"use client";

import { Fragment, useState } from "react";
import { formatDuration, type VercelDeployment } from "@/lib/admin-vercel";

const STATE_CLASS: Record<string, string> = {
  READY: "border-[#3fb950]/40 text-[#3fb950]",
  ERROR: "border-[#f85149]/40 text-[#f85149]",
  BUILDING: "border-[#d29922]/40 text-[#d29922]",
  QUEUED: "border-[#d29922]/40 text-[#d29922]",
  CANCELED: "border-neutral-800 text-neutral-500",
};

export function DeploymentTable({ deployments }: { deployments: VercelDeployment[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (deployments.length === 0) {
    return (
      <p className="py-6 text-center font-mono text-xs text-neutral-600">
        Aucun déploiement.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-neutral-900">
            {["Quand", "État", "Cible", "Commit", "Source", "Durée"].map((h) => (
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
          {deployments.map((d) => {
            const expanded = open === d.uid;
            return (
              // A panel in place rather than a third route: the row you
              // clicked stays on screen next to the ones around it, which
              // is the comparison you opened the table for.
              <Fragment key={d.uid}>
                <tr
                  onClick={() => setOpen(expanded ? null : d.uid)}
                  className="cursor-pointer border-b border-neutral-900/60 hover:bg-neutral-900/40"
                >
                  <td className="px-2 py-2 whitespace-nowrap text-neutral-500">
                    {d.created ? new Date(d.created).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-block border px-1.5 py-0.5 text-[0.65rem] ${
                        STATE_CLASS[d.state] ?? "border-neutral-800 text-neutral-400"
                      }`}
                    >
                      {d.state.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-neutral-400">{d.target ?? "—"}</td>
                  <td className="px-2 py-2 text-neutral-300">
                    {d.shaShort ?? "—"}
                    {d.branch && (
                      <span className="ml-2 text-[0.65rem] text-neutral-600">{d.branch}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-neutral-500">{d.source ?? "—"}</td>
                  <td className="px-2 py-2 text-neutral-500">
                    {formatDuration(d.durationMs)}
                  </td>
                </tr>

                {expanded && (
                  <tr className="border-b border-neutral-900/60">
                    <td colSpan={6} className="px-2 py-3">
                      <dl className="flex flex-col gap-1.5">
                        <div className="flex gap-3">
                          <dt className="w-24 shrink-0 text-neutral-600">Alias</dt>
                          <dd className="break-all text-neutral-300">{d.url || "—"}</dd>
                        </div>
                        {d.commitMessage && (
                          <div className="flex gap-3">
                            <dt className="w-24 shrink-0 text-neutral-600">Message</dt>
                            <dd className="text-neutral-300">{d.commitMessage}</dd>
                          </div>
                        )}
                        {d.author && (
                          <div className="flex gap-3">
                            <dt className="w-24 shrink-0 text-neutral-600">Auteur</dt>
                            <dd className="text-neutral-300">{d.author}</dd>
                          </div>
                        )}
                        {d.aliasError && (
                          <div className="flex gap-3">
                            <dt className="w-24 shrink-0 text-neutral-600">Erreur</dt>
                            <dd className="text-[#f85149]">{d.aliasError}</dd>
                          </div>
                        )}
                        {d.inspectorUrl && (
                          <div className="flex gap-3">
                            <dt className="w-24 shrink-0 text-neutral-600">Vercel</dt>
                            <dd>
                              <a
                                href={d.inspectorUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-neutral-400 underline underline-offset-2 hover:text-neutral-100"
                              >
                                ouvrir l&apos;inspecteur ↗
                              </a>
                            </dd>
                          </div>
                        )}
                      </dl>
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
