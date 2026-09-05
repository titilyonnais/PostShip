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

  const { identity, usage, payment, risk } = detail;
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
          {risk.level === "high" && <Tag tone="bad">risque {risk.score}</Tag>}
          {risk.level === "watch" && <Tag tone="warn">risque {risk.score}</Tag>}
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
                        <RefundAction userId={identity.id} chargeId={c.id} />
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

      <Panel title={`Risque — ${risk.score}/100`}>
        {risk.rules.length === 0 ? (
          <p className="font-mono text-xs text-[#3fb950]">Aucun signal.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 font-mono text-xs">
            {risk.rules.map((rule) => (
              <li key={rule.id} className="flex items-baseline justify-between gap-3">
                <span className="text-neutral-300">{rule.label}</span>
                <span className="shrink-0 text-[#d29922]">+{rule.points}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 font-mono text-[0.65rem] text-neutral-700">
          Règles fixes, pas un modèle. Les règles qui ont déclenché sont
          affichées : un score seul ne dit pas quoi regarder.
        </p>
      </Panel>
    </div>
  );
}
