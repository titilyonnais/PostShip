import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusDot } from "@/components/status-dot";
import { createClient } from "@/lib/db/server";

const STATUS_LABEL: Record<string, string> = {
  queued: "En attente de démarrage",
  running: "En cours",
  done: "Terminé",
  error: "Erreur",
};

export const metadata = {
  title: "Scan complet",
};

export default async function ScanReportPage({
  params,
}: {
  params: Promise<{ projectId: string; scanId: string }>;
}) {
  const { projectId, scanId } = await params;
  const supabase = await createClient();

  const { data: scan } = await supabase
    .from("site_scans")
    .select("*")
    .eq("id", scanId)
    .eq("project_id", projectId)
    .single();

  if (!scan) notFound();

  const { data: pages } = await supabase
    .from("site_scan_pages")
    .select("*")
    .eq("scan_id", scanId)
    .order("url");

  const isActive = scan.status === "queued" || scan.status === "running";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <AutoRefresh active={isActive} />

      <div className="flex flex-col gap-1">
        <Link
          href={`/app/${projectId}`}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Retour au projet
        </Link>
        <h1 className="flex items-center gap-2 font-mono text-lg">
          <ScanSearch className="size-4 text-muted-foreground" aria-hidden="true" />
          {scan.seed_url}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Statut</p>
          <p className="mt-1 text-sm font-medium">
            {STATUS_LABEL[scan.status] ?? scan.status}
            {isActive && (
              <span className="ml-1.5 inline-block size-1.5 rounded-full bg-[#d29922] motion-safe:animate-pulse align-middle" />
            )}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pages scannées</p>
          <p className="mt-1 font-mono text-sm">{scan.pages_scanned}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">OK / En échec</p>
          <p className="mt-1 font-mono text-sm">
            {scan.pages_ok} / {scan.pages_failed}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Tokens dépensés</p>
          <p className="mt-1 font-mono text-sm">{scan.tokens_spent}</p>
        </div>
      </div>

      {scan.error && (
        <p role="alert" className="text-sm text-destructive">
          {scan.error}
        </p>
      )}

      {pages && pages.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {pages.map((page) => (
            <li
              key={page.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
            >
              <span className="min-w-0 truncate font-mono text-xs">{page.url}</span>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {page.status === "pending" ? (
                  <span>En attente</span>
                ) : (
                  <>
                    <span>
                      {page.http_status ?? "—"}
                      {page.ttfb_ms != null ? ` · ${page.ttfb_ms} ms` : ""}
                    </span>
                    <StatusDot status={page.outcome} />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {isActive
            ? "Découverte des pages en cours..."
            : "Aucune page trouvée."}
        </p>
      )}
    </div>
  );
}
