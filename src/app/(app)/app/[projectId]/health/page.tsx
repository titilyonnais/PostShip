import { notFound } from "next/navigation";
import { Globe, HeartPulse, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/db/server";
import { getProject } from "@/lib/db/loaders";
import { getHealthSnapshot } from "@/lib/health";
import { AddSslButton } from "./add-ssl-button";

export const metadata = {
  title: "Santé",
};

export default async function HealthPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) notFound();

  let hostname: string;
  try {
    hostname = new URL(project.base_url).hostname;
  } catch {
    notFound();
  }

  const supabase = await createClient();

  const [{ data: sslTarget }, { data: httpTarget }, health] = await Promise.all([
    supabase
      .from("check_targets")
      .select("id")
      .eq("project_id", projectId)
      .eq("kind", "ssl")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("check_targets")
      .select("id")
      .eq("project_id", projectId)
      .eq("kind", "http")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    getHealthSnapshot(supabase, projectId, hostname),
  ]);

  const [sslRun, httpRun] = await Promise.all([
    sslTarget
      ? supabase
          .from("check_runs")
          .select("details")
          .eq("target_id", sslTarget.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => r.data)
      : null,
    httpTarget
      ? supabase
          .from("check_runs")
          .select("details")
          .eq("target_id", httpTarget.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => r.data)
      : null,
  ]);

  const sslDaysRemaining = (sslRun?.details as { daysRemaining?: number } | null)
    ?.daysRemaining;
  const robotsMeta = (
    httpRun?.details as { meta?: { robots?: string | null; xRobotsTag?: string | null } } | null
  )?.meta;
  const isNoindex =
    robotsMeta?.robots?.toLowerCase().includes("noindex") ||
    robotsMeta?.xRobotsTag?.toLowerCase().includes("noindex");

  const expiryDays = health.domainExpiry.daysRemaining;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          SSL
        </h2>
        {sslTarget ? (
          <p className="text-sm">
            {typeof sslDaysRemaining === "number"
              ? `${sslDaysRemaining} jour(s) avant expiration.`
              : "En attente du premier check."}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Aucun check SSL configuré pour ce projet.
            </p>
            <AddSslButton projectId={projectId} baseUrl={project.base_url} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Globe className="size-3.5" aria-hidden="true" />
          DNS
        </h2>
        {health.dns.hasRecords ? (
          <div className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
            {health.dns.a.length > 0 && <p>A : {health.dns.a.join(", ")}</p>}
            {health.dns.aaaa.length > 0 && <p>AAAA : {health.dns.aaaa.join(", ")}</p>}
            {health.dns.cname.length > 0 && <p>CNAME : {health.dns.cname.join(", ")}</p>}
          </div>
        ) : (
          <p className="text-sm text-destructive">
            Aucun enregistrement A ni AAAA — domaine orphelin ?
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <HeartPulse className="size-3.5" aria-hidden="true" />
          Expiration du domaine
        </h2>
        {expiryDays !== null ? (
          <div className="flex items-center gap-2 text-sm">
            <span>{expiryDays} jour(s) restant(s)</span>
            {expiryDays < 30 && (
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                Bientôt
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Date inconnue.</p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Indexation
        </h2>
        {httpTarget ? (
          <p className="text-sm">
            {isNoindex ? (
              <span className="text-amber-600 dark:text-amber-400">
                La page d&apos;accueil est en noindex.
              </span>
            ) : (
              "Pas de noindex détecté sur la page d'accueil."
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune cible HTTP pour lire les en-têtes d&apos;indexation.
          </p>
        )}
      </div>
    </div>
  );
}
