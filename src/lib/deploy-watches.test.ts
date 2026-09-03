import { describe, expect, it } from "vitest";
import { buildDeployWatchJobs, deployHintForWatchReason } from "./deploy-watches";

describe("buildDeployWatchJobs", () => {
  it("builds exactly 2 jobs, one T+2 and one T+8", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const jobs = buildDeployWatchJobs("proj-1", "deploy-1", now);

    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.reason).sort()).toEqual(["watch_t2", "watch_t8"]);
  });

  it("schedules run_after at +2min and +8min from now", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const jobs = buildDeployWatchJobs("proj-1", "deploy-1", now);

    const t2 = jobs.find((j) => j.reason === "watch_t2")!;
    const t8 = jobs.find((j) => j.reason === "watch_t8")!;

    expect(t2.run_after).toBe("2026-01-01T00:02:00.000Z");
    expect(t8.run_after).toBe("2026-01-01T00:08:00.000Z");
  });

  it("stamps every job with the same project and deploy event, queued", () => {
    const jobs = buildDeployWatchJobs("proj-1", "deploy-1");

    for (const job of jobs) {
      expect(job.project_id).toBe("proj-1");
      expect(job.deploy_event_id).toBe("deploy-1");
      expect(job.status).toBe("queued");
    }
  });

  // Insertion of a 3rd job for the same deploy is rejected by the DB's
  // unique (project_id, deploy_event_id, reason) index (migration 0048),
  // not by this pure builder — there are only 2 reasons to build from.
  it("never produces more than 2 reasons regardless of call count", () => {
    const jobsA = buildDeployWatchJobs("proj-1", "deploy-1");
    const jobsB = buildDeployWatchJobs("proj-1", "deploy-1");

    expect(new Set([...jobsA, ...jobsB].map((j) => j.reason)).size).toBe(2);
  });
});

describe("deployHintForWatchReason", () => {
  it("maps watch_t2 -> T+2 and watch_t8 -> T+8", () => {
    expect(deployHintForWatchReason("watch_t2")).toBe("T+2");
    expect(deployHintForWatchReason("watch_t8")).toBe("T+8");
  });
});
