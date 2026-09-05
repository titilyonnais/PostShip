import Link from "next/link";
import { notFound } from "next/navigation";
import { Cell, Metric, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { getIpDetail } from "@/lib/admin-visitors";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { TrustToggle } from "./trust-toggle";

export const metadata = { title: "Adresse IP" };
export const dynamic = "force-dynamic";

export default async function ConsoleIpDetail({
  params,
}: {
  params: Promise<{ ip: string }>;
}) {
  const { ip: raw } = await params;
  const ip = decodeURIComponent(raw);
  const detail = await getIpDetail(ip);

  if (!detail.profile) notFound();

  const { profile, accounts, visits } = detail;
  const browsers = new Set(visits.map((v) => v.browser).filter(Boolean));
  const languages = new Set(visits.map((v) => v.acceptLanguage).filter(Boolean));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/visitors"
            className="font-mono text-xs text-neutral-600 hover:text-neutral-300"
          >
            ← visiteurs
          </Link>
          <h1 className="font-mono text-sm text-neutral-100">{profile.ip}</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile.trusted && <Tag tone="good">de confiance</Tag>}
          {profile.isBot && <Tag tone="warn">robot</Tag>}
          {profile.distinctUsers > 1 && (
            <Tag tone="bad">{profile.distinctUsers} comptes</Tag>
          )}
        </div>
      </div>

      <div className="grid gap-px bg-neutral-900 sm:grid-cols-4">
        <Metric label="Visites" value={profile.hits.toLocaleString("fr-FR")} />
        <Metric
          label="Comptes vus"
          value={String(profile.distinctUsers)}
          tone={profile.distinctUsers > 1 ? "bad" : "default"}
        />
        <Metric label="Navigateurs" value={String(browsers.size)} />
        <Metric label="Langues" value={String(languages.size)} />
      </div>

      <Panel title="Localisation">
        <div className="flex flex-col gap-4">
          <dl className="grid gap-1.5 font-mono text-xs sm:grid-cols-2">
            {[
              ["Pays", profile.country ?? "—"],
              ["Région", profile.region ?? "—"],
              ["Ville", profile.city ?? "—"],
              ["Fuseau", profile.timezone ?? "—"],
              [
                "Coordonnées",
                profile.latitude !== null && profile.longitude !== null
                  ? `${profile.latitude.toFixed(3)}, ${profile.longitude.toFixed(3)}`
                  : "—",
              ],
              ["Première visite", formatRelativeTime(profile.firstSeenAt)],
              ["Dernière visite", formatRelativeTime(profile.lastSeenAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-neutral-500">{label}</dt>
                <dd className="text-neutral-200">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Marking an address trusted is what stops an office or a VPN
              the operator uses from scoring against every account behind
              it, forever. */}
          <TrustToggle ip={profile.ip} trusted={profile.trusted} />
        </div>
      </Panel>

      <Panel title={`Comptes vus depuis cette adresse (${accounts.length})`}>
        <Table head={["Compte", "Visites", "Dernière"]} empty={accounts.length === 0}>
          {accounts.map((a) => (
            <Row key={a.userId}>
              <Cell>
                <Link
                  href={`/admin/users/${a.userId}`}
                  className="text-neutral-200 underline-offset-2 hover:underline"
                >
                  {a.email ?? a.userId}
                </Link>
              </Cell>
              <Cell>{a.hits}</Cell>
              <Cell className="text-neutral-500">{formatRelativeTime(a.lastSeenAt)}</Cell>
            </Row>
          ))}
        </Table>
        {accounts.length > 1 && !profile.trusted && (
          <p className="mt-3 font-mono text-[0.65rem] text-[#f85149]">
            Plusieurs comptes derrière une même adresse est le signal de
            liaison le plus fort disponible sans données tierces. Ce n&apos;est
            pas une preuve : un bureau, un campus ou un opérateur mobile
            produisent exactement la même chose — d&apos;où le marquage « de
            confiance ».
          </p>
        )}
      </Panel>

      <Panel title={`Dernières visites (${visits.length})`}>
        <Table
          head={["Quand", "Page", "Navigateur", "Système", "Appareil", "Langue", "Provenance"]}
          empty={visits.length === 0}
        >
          {visits.map((v, i) => (
            <Row key={`${v.at}-${i}`}>
              <Cell className="whitespace-nowrap text-neutral-500">
                {new Date(v.at).toLocaleString("fr-FR")}
              </Cell>
              <Cell className="max-w-[200px] truncate">{v.path}</Cell>
              <Cell className="text-neutral-400" title={v.userAgent ?? undefined}>
                {v.browser ?? "—"}
              </Cell>
              <Cell className="text-neutral-400">{v.os ?? "—"}</Cell>
              <Cell className="text-neutral-500">{v.device ?? "—"}</Cell>
              <Cell className="max-w-[120px] truncate text-neutral-600">
                {v.acceptLanguage ?? "—"}
              </Cell>
              <Cell className="max-w-[160px] truncate text-neutral-600">
                {v.referer ?? "direct"}
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
