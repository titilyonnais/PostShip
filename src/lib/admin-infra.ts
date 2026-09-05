// Third-party quota and spend, for the admin page. Every provider is
// optional: without its token the panel says so rather than disappearing,
// because "not configured" and "nothing to report" look identical
// otherwise and only one of them is a problem you can fix.
//
// All three hosts are literals, so nothing here goes through the SSRF
// guard (same reasoning as src/lib/github-check.ts).

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

async function fetchJson(
  url: string,
  headers: Record<string, string>,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
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

  const [user, deployments] = await Promise.all([
    fetchJson("https://api.vercel.com/v2/user", headers),
    fetchJson(`https://api.vercel.com/v6/deployments${team || "?"}&limit=100`.replace("?&", "?"), headers),
  ]);

  if (!user && !deployments) {
    return { ...base, error: "Vercel n'a pas répondu — vérifiez le jeton." };
  }

  const deploys = (deployments as { deployments?: { created: number; state: string }[] } | null)
    ?.deployments ?? [];
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
  const project = (await fetchJson(
    `https://api.supabase.com/v1/projects/${ref}`,
    headers,
  )) as { status?: string; region?: string; created_at?: string } | null;

  if (!project) {
    return { ...base, error: "Supabase n'a pas répondu — vérifiez le jeton." };
  }

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

  const domains = (await fetchJson("https://api.resend.com/domains", {
    Authorization: `Bearer ${token}`,
  })) as { data?: { name: string; status: string }[] } | null;

  if (!domains) {
    return { ...base, error: "Resend n'a pas répondu — vérifiez la clé." };
  }

  const list = domains.data ?? [];
  return {
    ...base,
    metrics: [
      { label: "Domaines", value: String(list.length) },
      {
        label: "Vérifiés",
        value: String(list.filter((d) => d.status === "verified").length),
        hint: list.map((d) => `${d.name} (${d.status})`).join(", ") || undefined,
      },
    ],
  };
}

export async function getInfraPanels(): Promise<InfraPanel[]> {
  return Promise.all([vercelPanel(), supabasePanel(), resendPanel()]);
}
