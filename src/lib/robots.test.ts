import { describe, expect, it } from "vitest";
import { isDisallowed, parseRobotsDisallow } from "./robots";

describe("parseRobotsDisallow", () => {
  it("returns the wildcard group's rules when no specific UA group exists", () => {
    const text = `
User-agent: *
Disallow: /admin
Disallow: /private
`;
    expect(parseRobotsDisallow(text, "postshipbot")).toEqual([
      "/admin",
      "/private",
    ]);
  });

  it("prefers a group matching our own user-agent over the wildcard", () => {
    const text = `
User-agent: *
Disallow: /admin

User-agent: PostShipBot
Disallow: /internal-only
`;
    expect(parseRobotsDisallow(text, "postshipbot")).toEqual(["/internal-only"]);
  });

  it("treats consecutive User-agent lines as one shared group", () => {
    const text = `
User-agent: Googlebot
User-agent: PostShipBot
Disallow: /no-bots
`;
    expect(parseRobotsDisallow(text, "postshipbot")).toEqual(["/no-bots"]);
  });

  it("returns an empty list when nothing matches", () => {
    const text = `
User-agent: Googlebot
Disallow: /only-for-google
`;
    expect(parseRobotsDisallow(text, "postshipbot")).toEqual([]);
  });

  it("ignores comments and blank lines", () => {
    const text = `
# comment
User-agent: *

# another comment
Disallow: /admin
`;
    expect(parseRobotsDisallow(text, "postshipbot")).toEqual(["/admin"]);
  });
});

describe("isDisallowed", () => {
  it("matches an exact path prefix", () => {
    expect(isDisallowed("/admin/users", ["/admin"])).toBe(true);
  });

  it("does not match an unrelated path", () => {
    expect(isDisallowed("/blog/post-1", ["/admin"])).toBe(false);
  });

  it("empty rule (blanket Disallow:) never blocks anything", () => {
    expect(isDisallowed("/anything", [""])).toBe(false);
  });
});
