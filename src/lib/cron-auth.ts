import { timingSafeEqual } from "node:crypto";

// A bare `!==` string comparison leaks timing information and, worse, fails
// OPEN if CRON_SECRET is unset in the environment: `authHeader !==
// \`Bearer ${undefined}\`` only rejects a request that isn't literally the
// string "Bearer undefined" — anything else (including no header at all get
// treated the same as a wrong secret, but a request that happens to send
// exactly that string would pass). Fail closed instead: refuse every
// request outright when the secret isn't configured.
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");

  return (
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)
  );
}
