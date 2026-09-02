import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import {
  guardedFetch,
  MAX_BODY_BYTES,
  readBodyCapped,
  TIMEOUT_MS,
} from "@/lib/checks/shared";

export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export type DomainVerifyResult =
  | { verified: true; method: "dns-txt" | "well-known" }
  | { verified: false; reason: string };

async function checkDnsTxt(host: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(host);
    // Each TXT record can arrive split into multiple quoted strings —
    // resolveTxt already gives each record as string[], join before
    // comparing.
    return records.some(
      (chunks) => chunks.join("").trim() === `postship-verify=${token}`,
    );
  } catch {
    return false;
  }
}

async function checkWellKnown(host: string, token: string): Promise<boolean> {
  const url = `https://${host}/.well-known/postship.txt`;
  const guard = await assertPublicHttpsUrl(url);
  if (!guard.ok) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await guardedFetch(url, { signal: controller.signal });
    if (!result.ok) return false;
    const { text } = await readBodyCapped(result.response, MAX_BODY_BYTES);
    return text.trim() === token;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyDomainOwnership(
  host: string,
  token: string,
): Promise<DomainVerifyResult> {
  if (await checkDnsTxt(host, token)) {
    return { verified: true, method: "dns-txt" };
  }
  if (await checkWellKnown(host, token)) {
    return { verified: true, method: "well-known" };
  }
  return {
    verified: false,
    reason:
      "Aucune preuve trouvée — ni enregistrement TXT, ni fichier well-known.",
  };
}
