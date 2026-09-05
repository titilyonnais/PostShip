import { Panel, Tag } from "@/components/admin/console-ui";
import { getInfraPanels } from "@/lib/admin-infra";

export const metadata = { title: "Système" };
export const dynamic = "force-dynamic";

const ENV_HINT: Record<string, string> = {
  vercel: "VERCEL_API_TOKEN",
  supabase: "SUPABASE_MANAGEMENT_TOKEN + SUPABASE_PROJECT_REF",
  resend: "RESEND_API_KEY",
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
              <p className="font-mono text-xs text-neutral-600">
                Jeton absent. Renseignez{" "}
                <span className="text-neutral-400">{ENV_HINT[panel.provider]}</span>.
              </p>
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
