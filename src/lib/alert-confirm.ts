// D6 (drill-nav backlog): the confirm-after-N-fails core logic, pulled
// out as pure functions so it's testable without spinning up runner.ts's
// full Supabase/HTTP integration.

// fail|error both count toward the streak (same grouping the runner uses
// for the project's overall last_status) — pass resets it to 0.
export function nextConsecutiveFails(
  outcome: "pass" | "fail" | "error",
  previousConsecutiveFails: number,
): number {
  return outcome === "pass" ? 0 : previousConsecutiveFails + 1;
}

export function shouldAlertFail(
  newConsecutiveFails: number,
  confirmCount: number,
): boolean {
  return newConsecutiveFails >= confirmCount;
}

// A "recovered" alert is only honest if a fail alert actually went out for
// this streak — otherwise (confirm=3, only 1 fail before it passed again)
// it's a phantom recovery email for an incident nobody was ever told about.
// previousConsecutiveFails is the streak length as it stood *before* this
// passing run — exactly the value that would have gated the last fail's
// own alert, so comparing it against confirmCount tells us whether that
// alert fired.
export function shouldAlertRecovered(
  previousOutcome: "pass" | "fail" | "error" | null,
  previousConsecutiveFails: number,
  confirmCount: number,
): boolean {
  if (!previousOutcome || previousOutcome === "pass") return false;
  return previousConsecutiveFails >= confirmCount;
}
