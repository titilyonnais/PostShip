import { z } from "zod";

// Shared by the manual-paste actions (src/app/(app)/app/[projectId]/actions.ts)
// and the OAuth quick-connect callbacks (src/app/api/oauth/*) — a plain
// zod schema can't live in a "use server" file (Next only allows async
// function exports there), and both call sites need the exact same
// validation regardless of how the URL was obtained.
export const discordWebhookSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/,
    "URL de webhook Discord invalide.",
  );

export const slackWebhookSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/hooks\.slack\.com\/services\/[\w-]+\/[\w-]+\/[\w-]+$/,
    "URL de webhook Slack invalide.",
  );
