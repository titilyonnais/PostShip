import { createSign } from "node:crypto";

// GitHub App authentication, so the Checks integration stops depending on
// a fine-grained PAT the user has to create by hand, paste once, and
// remember to rotate. An installation is one click, is scoped to the
// repositories the user picks on GitHub's own screen, and is revoked from
// GitHub rather than from here.
//
// Two steps, both documented under "Authenticating as a GitHub App":
// sign a short-lived RS256 JWT with the app's private key, then exchange
// it for an installation access token (valid one hour) for the specific
// installation. No JWT library — node:crypto signs RS256 directly.
//
// Host is the literal api.github.com, not user input, so nothing here
// goes through the SSRF guard (same reasoning as src/lib/github-check.ts).
const API = "https://api.github.com";
const TIMEOUT_MS = 12_000;
const UA = "PostShipBot/0.1 (+https://postship.fr)";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

// Vercel stores a multi-line value fine, but a PEM pasted through a shell
// or a .env line usually arrives with literal \n sequences instead of real
// newlines — accept both rather than failing with an opaque crypto error.
function privateKey(): string | null {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!raw) return null;
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function isGithubAppConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID && privateKey());
}

export function githubAppInstallUrl(state: string): string | null {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return null;
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
}

function appJwt(): string | null {
  const appId = process.env.GITHUB_APP_ID;
  const key = privateKey();
  if (!appId || !key) return null;

  const now = Math.floor(Date.now() / 1000);
  // 60s back-dated for clock skew, 9 minutes ahead — GitHub rejects
  // anything claiming more than 10.
  const payload = { iat: now - 60, exp: now + 540, iss: appId };

  const signingInput =
    `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.` +
    `${base64url(JSON.stringify(payload))}`;

  try {
    const signature = createSign("RSA-SHA256").update(signingInput).sign(key);
    return `${signingInput}.${base64url(signature)}`;
  } catch (err) {
    console.error("Clé privée GitHub App inutilisable", err);
    return null;
  }
}

async function githubFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": UA,
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    console.error("Appel GitHub échoué", path, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Confirms an installation id really belongs to this app before it is
// stored — the id arrives as a query parameter on the setup redirect, so
// it is user-supplied until GitHub itself vouches for it.
export async function verifyInstallation(installationId: number): Promise<boolean> {
  const jwt = appJwt();
  if (!jwt) return false;
  const response = await githubFetch(`/app/installations/${installationId}`, jwt);
  return Boolean(response?.ok);
}

export async function createInstallationToken(
  installationId: number,
): Promise<string | null> {
  const jwt = appJwt();
  if (!jwt) return null;

  const response = await githubFetch(
    `/app/installations/${installationId}/access_tokens`,
    jwt,
    { method: "POST" },
  );

  if (!response?.ok) {
    console.error(
      "Échec création du jeton d'installation GitHub",
      response?.status,
      await response?.text().catch(() => ""),
    );
    return null;
  }

  const body = (await response.json().catch(() => null)) as { token?: string } | null;
  return body?.token ?? null;
}
