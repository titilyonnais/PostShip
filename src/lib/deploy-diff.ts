// D7 (drill-nav backlog): compares a deploy's per-target outcome snapshot
// (deploy_events.snapshot, written right after runProjectChecks/
// runPreviewChecks) against the previous deploy's snapshot for the same
// project, to label rows "Cassé depuis" / "Rétabli depuis" on the Déplois
// page without re-querying check_runs.
export type SnapshotItem = {
  targetId: string;
  url: string;
  outcome: "pass" | "fail" | "error";
};

export type DeployDiff = {
  addedFails: SnapshotItem[];
  recovered: SnapshotItem[];
};

export function diffDeploySnapshots(
  previous: SnapshotItem[],
  current: SnapshotItem[],
): DeployDiff {
  const previousByTarget = new Map(previous.map((item) => [item.targetId, item]));

  const addedFails: SnapshotItem[] = [];
  const recovered: SnapshotItem[] = [];

  for (const item of current) {
    const before = previousByTarget.get(item.targetId);
    const wasFailing = before ? before.outcome !== "pass" : false;
    const isFailing = item.outcome !== "pass";

    if (isFailing && !wasFailing) addedFails.push(item);
    if (!isFailing && wasFailing) recovered.push(item);
  }

  return { addedFails, recovered };
}
