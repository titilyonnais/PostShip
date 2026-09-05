import { MetricChart } from "@/components/admin/metric-chart";
import { Cell, Metric, Panel, Row, Table } from "@/components/admin/console-ui";
import { getOutstandingInvoices, getStripeSnapshot } from "@/lib/admin";
import { formatAmount } from "@/lib/billing-history";
import { OutstandingActions } from "./outstanding-row";

export const metadata = { title: "Revenu" };
export const dynamic = "force-dynamic";

export default async function ConsoleRevenue() {
  const [stripe, outstanding] = await Promise.all([
    getStripeSnapshot(),
    getOutstandingInvoices(),
  ]);

  if (!stripe) {
    return (
      <p className="font-mono text-xs text-[#f85149]">
        Stripe n&apos;a pas répondu.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-mono text-sm text-neutral-100">Revenu</h1>

      <Panel title={`Impayés (${outstanding.length})`}>
        <Table
          head={["Client", "Montant", "Âge", "Tentatives", "Prochaine", "Facture", "Action"]}
          empty={outstanding.length === 0}
        >
          {outstanding.map((invoice) => (
            <Row key={invoice.id}>
              <Cell className="break-all">
                {invoice.customerEmail ?? invoice.customerId ?? invoice.id}
              </Cell>
              <Cell className="text-[#d29922]">
                {formatAmount(invoice.amount, invoice.currency)}
              </Cell>
              <Cell className={invoice.ageDays > 7 ? "text-[#f85149]" : "text-neutral-500"}>
                {invoice.ageDays} j
              </Cell>
              <Cell className="text-neutral-500">{invoice.attemptCount}</Cell>
              <Cell className="text-neutral-500">
                {invoice.nextAttempt
                  ? new Date(invoice.nextAttempt * 1000).toLocaleDateString("fr-FR")
                  : "—"}
              </Cell>
              <Cell>
                {invoice.hostedUrl && (
                  <a
                    href={invoice.hostedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-500 underline underline-offset-2 hover:text-neutral-200"
                  >
                    payer ↗
                  </a>
                )}
              </Cell>
              <Cell>
                <OutstandingActions invoiceId={invoice.id} />
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>

      <div className="grid gap-px bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="MRR"
          value={formatAmount(stripe.mrr, stripe.currency)}
          hint="abonnements actifs, ramenés au mois"
        />
        <Metric label="Abonnements" value={String(stripe.activeSubscriptions)} />
        <Metric
          label="Impayés"
          value={String(stripe.pastDueSubscriptions)}
          tone={stripe.pastDueSubscriptions > 0 ? "bad" : "good"}
        />
        <Metric
          label="Impayés en attente"
          value={String(outstanding.length)}
          tone={outstanding.length > 0 ? "bad" : "good"}
          hint="factures ouvertes chez Stripe"
        />
        <Metric
          label="Résiliations ce mois"
          value={String(stripe.canceledThisMonth)}
          tone={stripe.canceledThisMonth > 0 ? "warn" : "good"}
        />
      </div>

      {stripe.revenueByMonth.length > 1 && (
        <Panel title="Encaissé par mois">
          <MetricChart
            labels={stripe.revenueByMonth.map((m) => m.month.slice(2))}
            series={[
              {
                key: "revenue",
                label: "Encaissé",
                color: "#3fb950",
                values: stripe.revenueByMonth.map((m) => m.amount),
              },
            ]}
            format="currency"
            currency={stripe.currency}
          />
        </Panel>
      )}

      <Panel title="Paiements en échec">
        <Table
          head={["Client", "Montant", "Date"]}
          empty={stripe.failedInvoices.length === 0}
        >
          {stripe.failedInvoices.map((i) => (
            <Row key={i.id}>
              <Cell className="break-all">{i.customer ?? i.id}</Cell>
              <Cell className="text-[#f85149]">
                {formatAmount(i.amount, stripe.currency)}
              </Cell>
              <Cell className="text-neutral-500">
                {new Date(i.created * 1000).toLocaleDateString("fr-FR")}
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
