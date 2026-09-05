import { describe, expect, it } from "vitest";
import { classifyAddress, detectBot } from "./bot-detection";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// What a browser actually sends when someone types a URL and hits enter.
const browserHeaders = (ua: string) => ({
  userAgent: ua,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8",
  secFetchMode: "navigate",
  secFetchDest: "document",
  secFetchSite: "none",
});

const bare = (ua: string | null) => ({
  userAgent: ua,
  accept: null,
  acceptLanguage: null,
  secFetchMode: null,
  secFetchDest: null,
  secFetchSite: null,
});

describe("detectBot", () => {
  it("does not flag a phone browsing normally — the bug this replaces", () => {
    const verdict = detectBot(browserHeaders(IPHONE));
    expect(verdict.isBot).toBe(false);
    expect(verdict.score).toBe(0);
    expect(verdict.signals).toEqual([]);
  });

  it("does not flag a desktop browser either", () => {
    expect(detectBot(browserHeaders(CHROME)).isBot).toBe(false);
  });

  it("settles immediately on a self-declared crawler", () => {
    const verdict = detectBot(bare("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"));
    expect(verdict.isBot).toBe(true);
    expect(verdict.score).toBe(100);
    expect(verdict.signals[0].id).toBe("ua.declared");
  });

  it("catches command-line tools and headless browsers", () => {
    for (const ua of [
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/126.0.0.0",
      "node-fetch/1.0",
    ]) {
      expect(detectBot(bare(ua)).isBot, ua).toBe(true);
    }
  });

  it("catches monitoring services, ours included", () => {
    expect(detectBot(bare("PostShipBot/0.1 (+https://postship.fr)")).isBot).toBe(true);
    expect(detectBot(bare("Pingdom.com_bot_version_1.4")).isBot).toBe(true);
  });

  it("treats an empty user agent as automated", () => {
    expect(detectBot(bare("")).isBot).toBe(true);
    expect(detectBot(bare(null)).isBot).toBe(true);
  });

  it("sees through a spoofed browser user agent via the fetch metadata", () => {
    // A scraper copying Chrome's UA but sending none of the headers the
    // browser itself would add.
    const verdict = detectBot(bare(CHROME));
    expect(verdict.isBot).toBe(true);
    expect(verdict.signals.map((s) => s.id)).toContain("fetch.no_mode");
    expect(verdict.signals.map((s) => s.id)).toContain("no_language");
  });

  it("does not tip on a single missing header", () => {
    // An older browser without Sec-Fetch-* is still a browser if it sends
    // everything else. 35 points is under the threshold on its own.
    const verdict = detectBot({
      ...browserHeaders(CHROME),
      secFetchMode: null,
    });
    expect(verdict.score).toBe(35);
    expect(verdict.isBot).toBe(false);
  });

  it("explains itself, so a wrong verdict can be argued with", () => {
    const verdict = detectBot(bare(CHROME));
    expect(verdict.signals.length).toBeGreaterThan(1);
    for (const signal of verdict.signals) {
      expect(signal.label).toBeTruthy();
      expect(signal.weight).toBeGreaterThan(0);
    }
  });
});

describe("classifyAddress", () => {
  it("does not brand an address on a single crawler hit", () => {
    // The exact scenario that put a robot badge on a customer's phone.
    expect(classifyAddress(1, 40).label).toBe("humain");
  });

  it("marks an address mixed once automation is a real share of it", () => {
    expect(classifyAddress(5, 10).label).toBe("mixte");
  });

  it("only says robot when the traffic is essentially all automated", () => {
    expect(classifyAddress(19, 20).label).toBe("robot");
    expect(classifyAddress(8, 10).label).toBe("mixte");
  });

  it("treats an address with no traffic as human rather than guessing", () => {
    expect(classifyAddress(0, 0)).toEqual({ label: "humain", ratio: 0 });
  });
});
