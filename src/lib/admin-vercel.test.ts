import { describe, expect, it } from "vitest";
import { formatDuration, parseDeployments } from "./admin-vercel";

// A frozen slice of a real GET /v6/deployments response, trimmed to the
// fields this code reads. Testing against this rather than the live API
// means the parser is pinned to a payload shape that actually existed.
const NOW = 1788617300000;
const HOUR = 60 * 60 * 1000;

const PAYLOAD = {
  deployments: [
    {
      uid: "dpl_ready",
      url: "postship-abc.vercel.app",
      state: "READY",
      readyState: "READY",
      target: "production",
      source: "cli",
      created: NOW - HOUR,
      buildingAt: NOW - HOUR + 1500,
      ready: NOW - HOUR + 81500,
      inspectorUrl: "https://vercel.com/team/postship/abc",
      aliasError: null,
      creator: { username: "skullyuhq" },
      meta: {
        githubCommitSha: "0123456789abcdef0123456789abcdef01234567",
        githubCommitMessage: "feat: something",
        githubCommitRef: "master",
      },
    },
    {
      uid: "dpl_error",
      url: "postship-def.vercel.app",
      state: "ERROR",
      target: "preview",
      source: "git",
      created: NOW - 3 * 24 * HOUR,
      aliasError: { message: "Alias already in use" },
      meta: {},
    },
    {
      uid: "dpl_old",
      url: "postship-ghi.vercel.app",
      state: "READY",
      target: "production",
      created: NOW - 30 * 24 * HOUR,
    },
  ],
};

describe("parseDeployments", () => {
  it("counts the rolling windows and ignores what falls outside them", () => {
    const { counts } = parseDeployments(PAYLOAD, NOW);
    // One in the last day, two in the last week, the 30-day-old one in
    // neither.
    expect(counts).toEqual({ day: 1, week: 2, failedWeek: 1 });
  });

  it("takes the newest deployment as the latest", () => {
    const { latest } = parseDeployments(PAYLOAD, NOW);
    expect(latest?.uid).toBe("dpl_ready");
    expect(latest?.state).toBe("READY");
    expect(latest?.target).toBe("production");
  });

  it("shortens the commit sha and keeps the message and branch", () => {
    const { latest } = parseDeployments(PAYLOAD, NOW);
    expect(latest?.shaShort).toBe("0123456");
    expect(latest?.commitMessage).toBe("feat: something");
    expect(latest?.branch).toBe("master");
    expect(latest?.author).toBe("skullyuhq");
  });

  it("computes build duration only when both timestamps are present", () => {
    const { deployments } = parseDeployments(PAYLOAD, NOW);
    expect(deployments[0].durationMs).toBe(80_000);
    expect(deployments[1].durationMs).toBeNull();
  });

  it("surfaces an alias error message when there is one", () => {
    const { deployments } = parseDeployments(PAYLOAD, NOW);
    expect(deployments[1].aliasError).toBe("Alias already in use");
    expect(deployments[0].aliasError).toBeNull();
  });

  it("falls back to readyState, and survives a payload with nothing in it", () => {
    const { deployments } = parseDeployments(
      { deployments: [{ uid: "x", readyState: "BUILDING" }] },
      NOW,
    );
    expect(deployments[0].state).toBe("BUILDING");
    expect(parseDeployments({}, NOW).latest).toBeNull();
    expect(parseDeployments(null, NOW).counts.week).toBe(0);
  });
});

describe("formatDuration", () => {
  it("reads in seconds under a minute and in minutes above", () => {
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(80_000)).toBe("1 min 20 s");
    expect(formatDuration(null)).toBe("—");
  });
});
