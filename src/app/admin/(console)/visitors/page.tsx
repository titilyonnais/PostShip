import Link from "next/link";
import { Cell, Metric, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { VisitGlobe } from "@/components/admin/visit-globe";
import { getVisitorOverview } from "@/lib/admin-visitors";
import { formatRelativeTime } from "@/lib/format-relative-time";

export const metadata = { title: "Visiteurs" };
export const dynamic = "force-dynamic";

// Flag emoji from an ISO country code: the letters map onto regional
// indicator symbols, so no icon set and no lookup table.
function flag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export default async function ConsoleVisitors() {
  const overview = await getVisitorOverview();
  const maxCountry = Math.max(1, ...overview.byCountry.map((c) => c.hits));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-mono text-sm text-neutral-100">Visiteurs</h1>

      <div className="grid gap-px bg-neutral-900 sm:grid-cols-4">
        <Metric label="Visites 24 h" value={overview.totals.visits24h.toLocaleString("fr-FR")} />
        <Metric label="Visites 7 j" value={overview.totals.visits7d.toLocaleString("fr-FR")} />
        <Metric label="Adresses connues" value={String(overview.totals.uniqueIps)} />
        <Metric label="Pays" value={String(overview.totals.countries)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Répartition mondiale">
          {overview.points.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-neutral-600">
              Aucune visite géolocalisée pour l&apos;instant. Les coordonnées
              viennent des en-têtes de l&apos;edge Vercel, donc elles
              n&apos;apparaissent qu&apos;en production.
            </p>
          ) : (
            <VisitGlobe points={overview.points} />
          )}
        </Panel>

        <Panel title="Par pays">
          {overview.byCountry.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-neutral-600">
              Aucune donnée.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {overview.byCountry.slice(0, 14).map((c) => (
                <li key={c.country} className="flex items-center gap-2 font-mono text-xs">
                  <span className="w-16 shrink-0 text-neutral-300">
                    {flag(c.country)} {c.country}
                  </span>
                  <span className="h-2 flex-1 bg-neutral-900">
                    <span
                      className="block h-full bg-[#3fb950]"
                      style={{ width: `${(c.hits / maxCountry) * 100}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right text-neutral-500">{c.hits}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Pages les plus vues">
        <Table head={["Page", "Vues"]} empty={overview.topPaths.length === 0}>
          {overview.topPaths.map((p) => (
            <Row key={p.path}>
              <Cell className="break-all">{p.path}</Cell>
              <Cell className="text-neutral-500">{p.hits}</Cell>
            </Row>
          ))}
        </Table>
      </Panel>

      <Panel title={`Adresses IP (${overview.ips.length})`}>
        <Table
          head={["IP", "Lieu", "Vues", "Comptes", "Première", "Dernière", ""]}
          empty={overview.ips.length === 0}
        >
          {overview.ips.map((ip) => (
            <Row key={ip.ip}>
              <Cell>
                <Link
                  href={`/admin/visitors/${encodeURIComponent(ip.ip)}`}
                  className="text-neutral-200 underline-offset-2 hover:underline"
                >
                  {ip.ip}
                </Link>
              </Cell>
              <Cell className="text-neutral-400">
                {flag(ip.country)}{" "}
                {[ip.city, ip.region, ip.country].filter(Boolean).join(", ") || "—"}
              </Cell>
              <Cell>{ip.hits}</Cell>
              <Cell className={ip.distinctUsers > 1 ? "text-[#f85149]" : "text-neutral-500"}>
                {ip.distinctUsers}
              </Cell>
              <Cell className="text-neutral-500">{formatRelativeTime(ip.firstSeenAt)}</Cell>
              <Cell className="text-neutral-500">{formatRelativeTime(ip.lastSeenAt)}</Cell>
              <Cell>
                {ip.trusted && <Tag tone="good">de confiance</Tag>}
                {ip.isBot && <Tag tone="warn">robot</Tag>}
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>

      <p className="font-mono text-[0.65rem] leading-relaxed text-neutral-700">
        Collecté pour la sécurité et la prévention de la fraude, base légale de
        l&apos;intérêt légitime (RGPD, considérant 49). Ni cookie, ni identifiant
        inter-sites, ni empreinte canvas ou WebGL : ceux-là exigent un
        consentement et ne répondent à aucune question posée ici. La
        géolocalisation vient des en-têtes de l&apos;edge Vercel, sans
        sous-traitant supplémentaire. Conservation 90 jours.
      </p>
    </div>
  );
}
