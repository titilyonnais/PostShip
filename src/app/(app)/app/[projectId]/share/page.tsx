import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Globe } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { OgCardPreview } from "@/components/og-card-preview";
import { createClient } from "@/lib/db/server";
import { getProject } from "@/lib/db/loaders";
import { toggleBadgePublic } from "../../actions";

export const metadata = {
  title: "Partage",
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) notFound();

  const supabase = await createClient();

  const [{ data: ogTargets }, { data: allTargets }, { data: sslTarget }] = await Promise.all([
    supabase.from("check_targets").select("id, url").eq("project_id", projectId).eq("kind", "og"),
    supabase
      .from("check_targets")
      .select("last_outcome")
      .eq("project_id", projectId)
      .eq("enabled", true),
    supabase
      .from("check_targets")
      .select("id")
      .eq("project_id", projectId)
      .eq("kind", "ssl")
      .limit(1)
      .maybeSingle(),
  ]);

  type OgCard = {
    id: string;
    title: string | null;
    description: string | null;
    image: string | null;
    domain: string;
  };

  const ogCards: OgCard[] = [];
  if (ogTargets && ogTargets.length > 0) {
    const targetIds = ogTargets.map((t) => t.id);
    const { data: runs } = await supabase
      .from("check_runs")
      .select("target_id, details")
      .in("target_id", targetIds)
      .order("started_at", { ascending: false })
      .limit(targetIds.length * 3);

    const latestByTarget = new Map<string, { details: Record<string, unknown> | null }>();
    for (const run of runs ?? []) {
      if (!latestByTarget.has(run.target_id)) latestByTarget.set(run.target_id, run);
    }

    for (const target of ogTargets) {
      const details = latestByTarget.get(target.id)?.details as
        | { ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null }
        | undefined;
      let domain = target.url;
      try {
        domain = new URL(target.url).hostname;
      } catch {
        // keep the raw url as a fallback label
      }
      ogCards.push({
        id: target.id,
        title: details?.ogTitle ?? null,
        description: details?.ogDescription ?? null,
        image: details?.ogImage ?? null,
        domain,
      });
    }
  }

  const passCount = (allTargets ?? []).filter((t) => t.last_outcome === "pass").length;
  const failCount = (allTargets ?? []).filter(
    (t) => t.last_outcome === "fail" || t.last_outcome === "error",
  ).length;

  let sslDaysRemaining: number | null = null;
  if (sslTarget) {
    const { data: lastRun } = await supabase
      .from("check_runs")
      .select("details")
      .eq("target_id", sslTarget.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const details = lastRun?.details as { daysRemaining?: number } | null;
    if (typeof details?.daysRemaining === "number") sslDaysRemaining = details.daysRemaining;
  }

  const statusText = `${project.name} — ${passCount} OK, ${failCount} en échec.${
    sslDaysRemaining !== null ? ` SSL J-${sslDaysRemaining}.` : ""
  }`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";
  const badgeMarkdown = `[![PostShip](${appUrl}/badge/${projectId})](${appUrl})`;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Cartes sociales
        </h2>
        {ogCards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ogCards.map((card) => (
              <OgCardPreview
                key={card.id}
                title={card.title}
                description={card.description}
                image={card.image}
                domain={card.domain}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <Globe className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Ajoutez un check OG depuis{" "}
              <Link
                href={`/app/${projectId}/urls`}
                className="text-foreground underline underline-offset-2"
              >
                URLs
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <BadgeCheck className="size-3.5 text-brand-2" aria-hidden="true" />
          Badge public
        </h2>
        <p className="text-xs text-muted-foreground">
          Un badge SVG minimal (&laquo; passing &raquo; / &laquo; failing
          &raquo;) que vous pouvez intégrer dans votre README — aucune URL ni
          détail de vos vérifications n&apos;y figure. Désactivé par défaut.
        </p>
        {project.badge_public && (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- our own dynamic SVG endpoint, not user content */}
            <img src={`/badge/${projectId}`} alt="Badge de statut PostShip" width={140} height={20} />
            <p className="rounded-sm bg-secondary px-2 py-1.5 font-mono text-xs break-all">
              {badgeMarkdown}
            </p>
          </div>
        )}
        <div>
          <ActionForm
            action={toggleBadgePublic.bind(null, project.id, !!project.badge_public)}
          >
            <SubmitButton variant="outline" pendingText="...">
              {project.badge_public
                ? "Désactiver le badge public"
                : "Activer le badge public"}
            </SubmitButton>
          </ActionForm>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Statut en une ligne
        </h2>
        {/* B2 (app-bar backlog): "Copier le statut" now lives in the
            app-bar's action slot on this page — it reads this exact string
            back out of the DOM via data-copy-status-text, so the button
            isn't duplicated here. */}
        <p className="font-mono text-xs text-muted-foreground" data-copy-status-text={statusText}>
          {statusText}
        </p>
      </section>
    </div>
  );
}
