// Third-party quota and spend, for the admin page. Every provider is
// optional: without its token the panel says so rather than disappearing,
// because "not configured" and "nothing to report" look identical
// otherwise and only one of them is a problem you can fix.
//
// All three hosts are literals, so nothing here goes through the SSRF
// guard (same reasoning as src/lib/github-check.ts).

import { createServiceClient } from "@/lib/db/service";

const TIMEOUT_MS = 8000;

export type InfraPanel = {
  provider: "vercel" | "supabase" | "resend";
  label: string;
  /** false when the token is missing — the UI shows setup instructions. */
  configured: boolean;
  /** true when configured but the call failed. */
  error: string | null;
  metrics: { label: string; value: string; hint?: string }[];
  /** Where the operator goes to see the full picture. */
  consoleUrl: string;
};

type FetchResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number | null };

// The status matters: a 401 from a key that is merely scoped too narrowly
// is a different problem from a provider being down, and telling the
// operator "vérifiez la clé" when the key is fine sends them chasing a
// bug that isn't there.
async function fetchJson(
  url: string,
  headers: Record<string, string>,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, status: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function vercelPanel(): Promise<InfraPanel> {
  const token = process.env.VERCEL_API_TOKEN;
  const base: InfraPanel = {
    provider: "vercel",
    label: "Vercel",
    configured: Boolean(token),
    error: null,
    metrics: [],
    consoleUrl: "https://vercel.com/dashboard",
  };
  if (!token) return base;

  const headers = { Authorization: `Bearer ${token}` };
  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : "";

  const deployments = await fetchJson(
    `https://api.vercel.com/v6/deployments${team || "?"}&limit=100`.replace("?&", "?"),
    headers,
  );

  if (!deployments.ok) {
    return {
      ...base,
      error:
        deployments.status === 401 || deployments.status === 403
          ? "Jeton refusé par Vercel — il a expiré ou ne couvre pas cette équipe."
          : "Vercel n'a pas répondu.",
    };
  }

  const deploys =
    (deployments.body as { deployments?: { created: number; state: string }[] })
      .deployments ?? [];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return {
    ...base,
    metrics: [
      {
        label: "Déploiements 24 h",
        value: String(deploys.filter((d) => d.created >= dayAgo).length),
      },
      {
        label: "Déploiements 7 j",
        value: String(deploys.filter((d) => d.created >= weekAgo).length),
      },
      {
        label: "Échecs 7 j",
        value: String(
          deploys.filter((d) => d.created >= weekAgo && d.state === "ERROR").length,
        ),
      },
    ],
  };
}

async function supabasePanel(): Promise<InfraPanel> {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  const base: InfraPanel = {
    provider: "supabase",
    label: "Supabase",
    configured: Boolean(token && ref),
    error: null,
    metrics: [],
    consoleUrl: ref ? `https://supabase.com/dashboard/project/${ref}` : "https://supabase.com/dashboard",
  };
  if (!token || !ref) return base;

  const headers = { Authorization: `Bearer ${token}` };
  const result = await fetchJson(`https://api.supabase.com/v1/projects/${ref}`, headers);

  if (!result.ok) {
    return {
      ...base,
      error:
        result.status === 401 || result.status === 403
          ? "Jeton refusé par Supabase — expiré, ou sans accès à ce projet."
          : "Supabase n'a pas répondu.",
    };
  }

  const project = result.body as {
    status?: string;
    region?: string;
    created_at?: string;
  };

  return {
    ...base,
    metrics: [
      { label: "État", value: project.status ?? "—" },
      { label: "Région", value: project.region ?? "—" },
      {
        label: "Créé le",
        value: project.created_at
          ? new Date(project.created_at).toLocaleDateString("fr-FR")
          : "—",
      },
    ],
  };
}

// Resend's read endpoints (domains, emails, api-keys) all require a
// full-access key. The key this app runs on is a sending key — which is
// the correct, least-privileged choice for something whose only job is to
// send — so it gets a 401 on every one of them. Reporting that as "clé
// invalide" sent the operator to check a key that was doing its job.
//
// So the useful numbers come from our own data instead: alert_events
// records one row per email actually sent, which is a better answer to
// "is mail going out" than anything Resend's dashboard would tell us.
async function resendPanel(): Promise<InfraPanel> {
  const token = process.env.RESEND_API_KEY;
  const base: InfraPanel = {
    provider: "resend",
    label: "Resend",
    configured: Boolean(token),
    error: null,
    metrics: [],
    consoleUrl: "https://resend.com/emails",
  };
  if (!token) return base;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const [day, week, domains] = await Promise.all([
    supabase
      .from("alert_events")
      .select("id", { count: "exact", head: true })
      .eq("channel", "email")
      .gte("sent_at", since24h),
    supabase
      .from("alert_events")
      .select("id", { count: "exact", head: true })
      .eq("channel", "email")
      .gte("sent_at", since7d),
    fetchJson("https://api.resend.com/domains", { Authorization: `Bearer ${token}` }),
  ]);

  const metrics: InfraPanel["metrics"] = [
    { label: "Expéditeur", value: process.env.RESEND_FROM ?? "—" },
    { label: "Alertes email 24 h", value: String(day.count ?? 0) },
    { label: "Alertes email 7 j", value: String(week.count ?? 0) },
  ];

  if (domains.ok) {
    const list = (domains.body as { data?: { name: string; status: string }[] }).data ?? [];
    metrics.push({
      label: "Domaines vérifiés",
      value: `${list.filter((d) => d.status === "verified").length}/${list.length}`,
      hint: list.map((d) => `${d.name} (${d.status})`).join(", ") || undefined,
    });
  } else if (domains.status === 401 || domains.status === 403) {
    metrics.push({
      label: "Domaines",
      value: "clé d'envoi",
      hint: "Une clé Resend d'envoi seul ne peut pas lire les domaines. C'est le bon niveau de privilège pour cette application.",
    });
  } else {
    metrics.push({ label: "Domaines", value: "indisponible" });
  }

  return { ...base, metrics };
}

export async function getInfraPanels(): Promise<InfraPanel[]> {
  return Promise.all([vercelPanel(), supabasePanel(), resendPanel()]);
}
