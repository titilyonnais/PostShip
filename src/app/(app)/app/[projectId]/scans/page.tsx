import Link from "next/link";
import { notFound } from "next/navigation";
import { Coins, ScanSearch } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusDot } from "@/components/status-dot";
import { createClient } from "@/lib/db/server";
import { getAuthUser, getProfile, getProject } from "@/lib/db/loaders";
import { ScanLaunchForm } from "../scan-launch-form";

export const metadata = {
  title: "Scans complets",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Découverte...",
  running: "En cours",
  done: "Terminé",
  error: "Erreur",
};

export default async function ProjectScansPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();

  const [project, user, { data: scans }] = await Promise.all([
    getProject(projectId),
    getAuthUser(),
    supabase
      .from("site_scans")
      .select(
        "id, seed_url, status, pages_scanned, total_pages, pages_ok, pages_failed, created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!project) notFound();

  const profile = user ? await getProfile(user.id) : null;
  const tokenBalance = profile?.token_balance ?? 0;

  const hasActiveScan = (scans ?? []).some(
    (s) => s.status === "queued" || s.status === "running",
  );

  return (
    <div className="flex flex-col gap-6">
      {hasActiveScan && <AutoRefresh intervalMs={5000} />}

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <ScanSearch className="size-3.5" aria-hidden="true" />
          Nouveau scan complet
        </h2>
        <p className="text-xs text-muted-foreground">
          Vérifie l&apos;état de chaque page (jusqu&apos;à 500) à
          l&apos;instant T — un rapport ponctuel, indépendant de vos URLs
          surveillées. 1 token/page, traité par lots toutes les ~5 min.
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="size-3.5" aria-hidden="true" />
          Solde : {tokenBalance} token(s)
          {tokenBalance === 0 && (
            <Link
              href={`/app/account?tab=tokens&from=${encodeURIComponent(`/app/${projectId}/scans`)}`}
              className="text-foreground underline underline-offset-2"
            >
              en acheter
            </Link>
          )}
        </p>
        <ScanLaunchForm
          projectId={projectId}
          baseUrl={project.base_url}
          tokenBalance={tokenBalance}
        />
      </div>

      {scans && scans.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {scans.map((scan) => {
            const active = scan.status === "queued" || scan.status === "running";
            const pct =
              scan.total_pages > 0
                ? Math.round((scan.pages_scanned / scan.total_pages) * 100)
                : 0;
            return (
              <li key={scan.id}>
                <Link
                  href={`/app/${projectId}/scans/${scan.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-sm">
                      {scan.seed_url}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(scan.created_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      {STATUS_LABEL[scan.status] ?? scan.status}
                      {!active && (
                        <>
                          {" — "}
                          {scan.pages_scanned}/{scan.total_pages || "?"} pages
                        </>
                      )}
                    </span>
                    {scan.status === "done" && (
                      <span className="flex items-center gap-3">
                        <StatusDot status="pass" />
                        {scan.pages_failed > 0 && (
                          <span className="text-destructive">
                            {scan.pages_failed} en échec
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {active && scan.total_pages > 0 && (
                    <span className="h-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-foreground transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <ScanSearch className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Aucun scan complet pour le moment.
          </p>
        </div>
      )}
    </div>
  );
}
