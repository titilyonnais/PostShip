import Link from "next/link";
import { notFound } from "next/navigation";
import { Cell, Metric, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { getUserDetail } from "@/lib/admin-user-detail";
import { formatAmount } from "@/lib/billing-history";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { AccessActions, RefundAction, SubscriptionActions } from "./user-actions";

export const metadata = { title: "Fiche client" };
export const dynamic = "force-dynamic";

const INVOICE_TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  paid: "good",
  failed: "bad",
  open: "warn",
  void: "neutral",
  draft: "neutral",
  uncollectible: "bad",
};

export default async function ConsoleUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const { identity, usage, payment, fraud, footprint } = detail;
  const risk = fraud.assessment;
  const banned =
    Boolean(identity.bannedUntil) && new Date(identity.bannedUntil!).getTime() > Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/users"
            className="font-mono text-xs text-neutral-600 hover:text-neutral-300"
          >
            ← utilisateurs
          </Link>
          <h1 className="font-mono text-sm text-neutral-100">{identity.email ?? identity.id}</h1>
        </div>
        <div className="flex items-center gap-2">
          {banned && <Tag tone="bad">banni</Tag>}
          {risk.band === "critical" && <Tag tone="bad">risque {risk.score} — critique</Tag>}
          {risk.band === "elevated" && <Tag tone="bad">risque {risk.score} — élevé</Tag>}
          {risk.band === "watch" && <Tag tone="warn">risque {risk.score} — à surveiller</Tag>}
        </div>
      </div>

      <Panel title="Identité">
        <div className="flex flex-col gap-4">
          <dl className="grid gap-1.5 font-mono text-xs sm:grid-cols-2">
            {[
              ["Identifiant", identity.id],
              ["Pseudo", identity.username ?? "—"],
              ["Nom affiché", identity.displayName ?? "—"],
              [
                "Créé",
                identity.createdAt
                  ? new Date(identity.createdAt).toLocaleDateString("fr-FR")
                  : "—",
              ],
              [
                "Dernière connexion",
                identity.lastSignInAt ? formatRelativeTime(identity.lastSignInAt) : "jamais",
              ],
              ["Fournisseurs", identity.providers.join(", ") || "email"],
              ["Plan", identity.plan ?? "free"],
              ["Abonnement", identity.stripeSubscriptionStatus ?? "—"],
              ["Tokens", String(identity.tokenBalance)],
              ["Client Stripe", identity.stripeCustomerId ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-neutral-500">{label}</dt>
                <dd className="break-all text-neutral-200">{value}</dd>
              </div>
            ))}
          </dl>

          {banned && (
            <Tag tone="bad">
              Banni jusqu&apos;au {new Date(identity.bannedUntil!).toLocaleString("fr-FR")}
            </Tag>
          )}

          <AccessActions userId={identity.id} banned={banned} />
        </div>
      </Panel>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
          Usage
        </h2>
        <div className="grid gap-px bg-neutral-900 sm:grid-cols-4">
          <Metric label="Projets" value={String(usage.projects)} />
          <Metric label="URLs" value={String(usage.targets)} />
          <Metric label="Checks 7 j" value={usage.checkRuns7d.toLocaleString("fr-FR")} />
          <Metric label="Scans 7 j" value={String(usage.scans7d)} />
        </div>
        <Panel title="Projets">
          <Table head={["Projet", "Identifiant", "Dernier état"]} empty={usage.recentProjects.length === 0}>
            {usage.recentProjects.map((p) => (
              <Row key={p.id}>
                <Cell>
                  <Link
                    href={`/admin/projects/${p.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {p.name}
                  </Link>
                </Cell>
                <Cell className="text-neutral-600">{p.id}</Cell>
                <Cell className="text-neutral-400">{p.lastStatus ?? "—"}</Cell>
              </Row>
            ))}
          </Table>
        </Panel>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
          Paiement
        </h2>

        {!payment.available ? (
          <Panel>
            <p className="font-mono text-xs text-neutral-600">
              Aucun client Stripe rattaché à ce compte.
            </p>
          </Panel>
        ) : (
          <>
            <Panel
              title="Abonnements"
              action={
                payment.portalCustomerUrl ? (
                  <a
                    href={payment.portalCustomerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[0.65rem] text-neutral-600 hover:text-neutral-300"
                  >
                    ouvrir dans Stripe ↗
                  </a>
                ) : undefined
              }
            >
              {payment.subscriptions.length === 0 ? (
                <p className="font-mono text-xs text-neutral-600">Aucun abonnement.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {payment.subscriptions.map((s) => (
                    <div key={s.id} className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                        <Tag
                          tone={
                            s.status === "active"
                              ? "good"
                              : s.status === "past_due" || s.status === "unpaid"
                                ? "bad"
                                : "warn"
                          }
                        >
                          {s.status}
                        </Tag>
                        <span className="text-neutral-300">{s.priceLabel}</span>
                        {s.currentPeriodEnd && (
                          <span className="text-neutral-500">
                            {s.cancelAtPeriodEnd ? "se termine" : "renouvelle"} le{" "}
                            {new Date(s.currentPeriodEnd * 1000).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                        <span className="text-neutral-700">{s.id}</span>
                      </div>
                      {(s.status === "active" || s.status === "past_due") && (
                        <SubscriptionActions
                          userId={identity.id}
                          subscriptionId={s.id}
                          cancelAtPeriodEnd={s.cancelAtPeriodEnd}
                          endsAtLabel={
                            s.currentPeriodEnd
                              ? new Date(s.currentPeriodEnd * 1000).toLocaleDateString("fr-FR")
                              : null
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Factures">
              <Table
                head={["Numéro", "Date", "Montant", "État", "Prochaine tentative", ""]}
                empty={payment.invoices.length === 0}
              >
                {payment.invoices.map((i) => (
                  <Row key={i.id}>
                    <Cell>{i.number ?? i.id}</Cell>
                    <Cell className="text-neutral-500">
                      {new Date(i.created * 1000).toLocaleDateString("fr-FR")}
                    </Cell>
                    <Cell>{formatAmount(i.amount, payment.currency)}</Cell>
                    <Cell>
                      <Tag tone={INVOICE_TONE[i.status] ?? "neutral"}>{i.status}</Tag>
                    </Cell>
                    <Cell className="text-neutral-500">
                      {i.nextAttempt
                        ? new Date(i.nextAttempt * 1000).toLocaleDateString("fr-FR")
                        : "—"}
                    </Cell>
                    <Cell>
                      {i.hostedUrl && (
                        <a
                          href={i.hostedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-500 underline underline-offset-2 hover:text-neutral-200"
                        >
                          facture ↗
                        </a>
                      )}
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Panel>

            <Panel title="Paiements">
              <Table
                head={["Date", "Montant", "État", "Action"]}
                empty={payment.charges.length === 0}
              >
                {payment.charges.map((c) => (
                  <Row key={c.id}>
                    <Cell className="text-neutral-500">
                      {new Date(c.created * 1000).toLocaleDateString("fr-FR")}
                    </Cell>
                    <Cell>{formatAmount(c.amount, payment.currency)}</Cell>
                    <Cell>
                      {c.disputed ? (
                        <Tag tone="bad">litige</Tag>
                      ) : c.refunded ? (
                        <Tag tone="warn">remboursé</Tag>
                      ) : (
                        <Tag tone={c.status === "succeeded" ? "good" : "neutral"}>{c.status}</Tag>
                      )}
                    </Cell>
                    <Cell>
                      {c.refundable ? (
                        <RefundAction
                          userId={identity.id}
                          chargeId={c.id}
                          amountLabel={formatAmount(c.amount, payment.currency)}
                        />
                      ) : (
                        <span className="text-neutral-700">—</span>
                      )}
                    </Cell>
                  </Row>
                ))}
              </Table>
              <p className="mt-2 font-mono text-[0.65rem] text-neutral-700">
                Le remboursement n&apos;est proposé que sur un paiement réussi,
                non remboursé, non contesté et de moins de 14 jours.
              </p>
            </Panel>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
          Empreinte
        </h2>

        <Panel title={`Adresses IP (${footprint.addresses.length})`}>
          <Table
            head={["IP", "Lieu", "Fuseau", "Vues", "Comptes", "Première", "Dernière"]}
            empty={footprint.addresses.length === 0}
          >
            {footprint.addresses.map((a) => (
              <Row key={a.ip}>
                <Cell>
                  <Link
                    href={`/admin/visitors/${encodeURIComponent(a.ip)}`}
                    className="text-neutral-200 underline-offset-2 hover:underline"
                  >
                    {a.ip}
                  </Link>
                  {a.trusted && <span className="ml-2 text-[0.65rem] text-[#3fb950]">de confiance</span>}
                </Cell>
                <Cell className="text-neutral-400">
                  {[a.city, a.region, a.country].filter(Boolean).join(", ") || "—"}
                </Cell>
                <Cell className="text-neutral-500">{a.timezone ?? "—"}</Cell>
                <Cell>{a.hits}</Cell>
                <Cell className={a.distinctUsers > 1 ? "text-[#f85149]" : "text-neutral-500"}>
                  {a.distinctUsers}
                </Cell>
                <Cell className="text-neutral-500">{formatRelativeTime(a.firstSeen)}</Cell>
                <Cell className="text-neutral-500">{formatRelativeTime(a.lastSeen)}</Cell>
              </Row>
            ))}
          </Table>
        </Panel>

        <Panel title="Dernières visites">
          <Table
            head={["Quand", "Page", "IP", "Lieu", "Appareil"]}
            empty={footprint.visits.length === 0}
          >
            {footprint.visits.map((v, i) => (
              <Row key={`${v.at}-${i}`}>
                <Cell className="whitespace-nowrap text-neutral-500">
                  {new Date(v.at).toLocaleString("fr-FR")}
                </Cell>
                <Cell className="max-w-[220px] truncate">{v.path}</Cell>
                <Cell className="text-neutral-400">{v.ip}</Cell>
                <Cell className="text-neutral-500">
                  {[v.city, v.country].filter(Boolean).join(", ") || "—"}
                </Cell>
                <Cell className="text-neutral-400" title={v.userAgent ?? undefined}>
                  {[v.browser, v.os, v.device].filter(Boolean).join(" · ") || "—"}
                  {v.isBot && <span className="ml-2 text-[#d29922]">robot</span>}
                </Cell>
              </Row>
            ))}
          </Table>
        </Panel>
      </div>

      <Panel title={`Score de fraude — ${risk.score}/100 (${risk.band})`}>
        {risk.features.length === 0 ? (
          <p className="font-mono text-xs text-[#3fb950]">Aucun signal.</p>
        ) : (
          <ul className="flex flex-col gap-2 font-mono text-xs">
            {risk.features.map((f) => (
              <li key={f.id} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-neutral-200">{f.label}</span>
                  <span className="shrink-0 text-[#d29922]">
                    +{f.points}
                    <span className="ml-1 text-neutral-700">/ {f.weight}</span>
                  </span>
                </div>
                <span className="text-[0.65rem] text-neutral-500">{f.evidence}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 font-mono text-[0.65rem] leading-relaxed text-neutral-700">
          Familles de features tirées de Bahnsen, Aouada, Stojanovic &amp;
          Ottersten, « Feature engineering strategies for credit card fraud
          detection » (Expert Systems with Applications, 2016) : agrégation RFM
          sur plusieurs fenêtres, et feature périodique mesurant l&apos;écart
          circulaire à l&apos;heure habituelle du compte. Ce n&apos;est pas un
          modèle : aucune fraude confirmée n&apos;a jamais été enregistrée ici,
          donc rien à entraîner. Chaque point affiché avec la mesure qui l&apos;a
          produit.
        </p>
      </Panel>
    </div>
  );
}
