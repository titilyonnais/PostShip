import { parse as parseHtml } from "node-html-parser";
import type { FetchBudget } from "@/lib/budgets";
import {
  computeFingerprint,
  guardedFetch,
  MAX_BODY_BYTES,
  readBodyCapped,
  TIMEOUT_MS,
  type CheckResult,
} from "@/lib/checks/shared";

export type OgCheckTarget = { url: string };

// Plus tard : rendu visuel de la social card (screenshot) — trop lourd
// pour ce check, qui reste un lint de balises + accessibilité de l'image.
const TITLE_MAX_LENGTH = 70;
// The usual practical ceiling social crawlers apply to a preview image.
const IMAGE_MAX_BYTES = 8_000_000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function metaContent(root: ReturnType<typeof parseHtml>, property: string) {
  return (
    root
      .querySelector(`meta[property="${property}" i]`)
      ?.getAttribute("content") ||
    root.querySelector(`meta[name="${property}" i]`)?.getAttribute("content") ||
    null
  );
}

export async function runOgCheck(
  target: OgCheckTarget,
  budget?: FetchBudget,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const pageResult = await guardedFetch(target.url, {
      signal: controller.signal,
      budget,
    });

    if (!pageResult.ok) {
      const details = {
        url: target.url,
        error: pageResult.reason,
        redirects: pageResult.redirects,
      };
      return {
        outcome: "error",
        http_status: pageResult.httpStatus,
        ttfb_ms: null,
        details,
        fingerprint: computeFingerprint("error", pageResult.httpStatus, details),
      };
    }

    const { response, finalUrl } = pageResult;
    const ttfbMs = Date.now() - started;
    const { text: bodyText } = await readBodyCapped(response, MAX_BODY_BYTES);
    const root = parseHtml(bodyText);

    const ogTitle = metaContent(root, "og:title");
    const ogDescription = metaContent(root, "og:description");
    const ogImage = metaContent(root, "og:image");
    const twitterCard = metaContent(root, "twitter:card");

    const missing: string[] = [];
    if (!ogTitle) missing.push("og:title");
    else if (ogTitle.length > TITLE_MAX_LENGTH) missing.push("og:title_too_long");
    if (!ogDescription) missing.push("og:description");
    if (!ogImage) missing.push("og:image");
    if (!twitterCard) missing.push("twitter:card");

    let ogImageStatus: number | null = null;
    if (ogImage) {
      const imageUrl = new URL(ogImage, finalUrl).toString();
      const imageResult = await guardedFetch(imageUrl, {
        signal: controller.signal,
        method: "HEAD",
        budget,
      });

      if (!imageResult.ok) {
        missing.push("og:image reachable");
      } else {
        ogImageStatus = imageResult.response.status;
        if (ogImageStatus !== 200) missing.push("og:image reachable");

        const contentType = imageResult.response.headers.get("content-type");
        if (contentType && !ALLOWED_IMAGE_TYPES.includes(contentType.split(";")[0].trim())) {
          missing.push("og:image_type");
        }

        const contentLength = imageResult.response.headers.get("content-length");
        if (contentLength && Number(contentLength) > IMAGE_MAX_BYTES) {
          missing.push("og:image_too_heavy");
        }
      }
    }

    const outcome: "pass" | "fail" = missing.length === 0 ? "pass" : "fail";
    const details = {
      url: finalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      ogImageStatus,
      twitterCard,
      missing,
    };

    return {
      outcome,
      http_status: response.status,
      ttfb_ms: ttfbMs,
      details,
      fingerprint: computeFingerprint(outcome, response.status, details),
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    const details = {
      url: target.url,
      error: isAbort ? "Timeout (12s)." : String(err),
    };
    return {
      outcome: "error",
      http_status: null,
      ttfb_ms: Date.now() - started,
      details,
      fingerprint: computeFingerprint("error", null, details),
    };
  } finally {
    clearTimeout(timeout);
  }
}
