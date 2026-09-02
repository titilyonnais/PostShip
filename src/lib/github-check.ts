// F7 (features backlog): posts one GitHub Check Run per deploy-triggered
// run, so PostShip's result shows up directly on the commit/PR instead of
// only in Discord/email/the dashboard. Host is the literal api.github.com
// — not user input, so nothing to SSRF-guard, unlike the Discord/Slack
// webhook URLs a user actually supplies.
const TIMEOUT_MS = 12_000;

export type GithubCheckRunParams = {
  repo: string; // "owner/repo"
  token: string;
  sha: string;
  conclusion: "success" | "failure";
  title: string;
  summary: string;
};

// Never throws — an invalid/expired token or a GitHub outage must not
// break the deploy webhook's own response; the site checks it triggered
// already ran regardless of whether this call succeeds.
export async function postGithubCheckRun(params: GithubCheckRunParams): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${params.repo}/check-runs`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "PostShipBot/0.1 (+https://postship.fr)",
        },
        body: JSON.stringify({
          name: "PostShip",
          head_sha: params.sha,
          status: "completed",
          conclusion: params.conclusion,
          output: { title: params.title, summary: params.summary },
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "Échec création du GitHub Check Run",
        response.status,
        await response.text().catch(() => ""),
      );
    }
  } catch (err) {
    console.error("Échec création du GitHub Check Run", err);
  } finally {
    clearTimeout(timeout);
  }
}
