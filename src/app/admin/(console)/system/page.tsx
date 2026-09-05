import { Panel, Tag } from "@/components/admin/console-ui";
import { getInfraPanels } from "@/lib/admin-infra";

export const metadata = { title: "Système" };
export const dynamic = "force-dynamic";

const ENV_HINT: Record<string, { vars: string; where: string; url: string }> = {
  vercel: {
    vars: "VERCEL_API_TOKEN",
    where: "Vercel → Account Settings → Tokens",
    url: "https://vercel.com/account/tokens",
  },
  supabase: {
    vars: "SUPABASE_MANAGEMENT_TOKEN + SUPABASE_PROJECT_REF",
    where: "Supabase → Account → Access Tokens",
    url: "https://supabase.com/dashboard/account/tokens",
  },
  resend: {
    vars: "RESEND_API_KEY",
    where: "Resend → API Keys",
    url: "https://resend.com/api-keys",
  },
};

export default async function ConsoleSystem() {
  const panels = await getInfraPanels();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-sm text-neutral-100">Système</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        {panels.map((panel) => (
          <Panel
            key={panel.provider}
            title={panel.label}
            action={
              <a
                href={panel.consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[0.65rem] text-neutral-600 hover:text-neutral-300"
              >
                console ↗
              </a>
            }
          >
            {!panel.configured ? (
              <div className="flex flex-col gap-1 font-mono text-xs text-neutral-600">
                <p>
                  Jeton absent — variable{" "}
                  <span className="text-neutral-400">
                    {ENV_HINT[panel.provider].vars}
                  </span>
                  .
                </p>
                <a
                  href={ENV_HINT[panel.provider].url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-500 underline underline-offset-2 hover:text-neutral-300"
                >
                  {ENV_HINT[panel.provider].where} ↗
                </a>
              </div>
            ) : panel.error ? (
              <Tag tone="bad">{panel.error}</Tag>
            ) : (
              <dl className="flex flex-col gap-1.5 font-mono text-xs">
                {panel.metrics.map((m) => (
                  <div key={m.label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-neutral-500">{m.label}</dt>
                    <dd className="text-neutral-200" title={m.hint}>
                      {m.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
