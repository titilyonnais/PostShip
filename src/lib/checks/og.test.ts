import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns", () => ({
  promises: { lookup: lookupMock },
}));

// Imported after the mock so guardedFetch's SSRF guard picks up the mocked dns.
const { runOgCheck } = await import("./og");

function htmlWithMeta(tags: Record<string, string>): string {
  const meta = Object.entries(tags)
    .map(([property, content]) => `<meta property="${property}" content="${content}">`)
    .join("\n");
  return `<html><head>${meta}</head><body></body></html>`;
}

function mockFetchSequence(pageResponse: Response, imageResponse?: Response) {
  const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
    if (init.method === "HEAD") {
      return Promise.resolve(imageResponse ?? new Response(null, { status: 404 }));
    }
    return Promise.resolve(pageResponse);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  lookupMock.mockReset();
  lookupMock.mockResolvedValue([{ address: "93.184.216.34" }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runOgCheck", () => {
  it("passes when every social tag and the image are present and valid", async () => {
    mockFetchSequence(
      new Response(
        htmlWithMeta({
          "og:title": "A short title",
          "og:description": "A description",
          "og:image": "https://example.com/card.png",
          "twitter:card": "summary_large_image",
        }),
        { status: 200 },
      ),
      new Response(null, {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "1000" },
      }),
    );

    const result = await runOgCheck({ url: "https://example.com" });
    expect(result.outcome).toBe("pass");
    expect(result.details.missing).toEqual([]);
  });

  it("fails when og:title exceeds 70 characters", async () => {
    mockFetchSequence(
      new Response(
        htmlWithMeta({
          "og:title": "x".repeat(71),
          "og:description": "A description",
          "og:image": "https://example.com/card.png",
          "twitter:card": "summary_large_image",
        }),
        { status: 200 },
      ),
      new Response(null, { status: 200, headers: { "content-type": "image/png" } }),
    );

    const result = await runOgCheck({ url: "https://example.com" });
    expect(result.outcome).toBe("fail");
    expect(result.details.missing).toContain("og:title_too_long");
  });

  it("fails when og:description is missing", async () => {
    mockFetchSequence(
      new Response(
        htmlWithMeta({
          "og:title": "A short title",
          "og:image": "https://example.com/card.png",
          "twitter:card": "summary_large_image",
        }),
        { status: 200 },
      ),
      new Response(null, { status: 200, headers: { "content-type": "image/png" } }),
    );

    const result = await runOgCheck({ url: "https://example.com" });
    expect(result.outcome).toBe("fail");
    expect(result.details.missing).toContain("og:description");
  });

  it("fails when the image content-type isn't an allowed image format", async () => {
    mockFetchSequence(
      new Response(
        htmlWithMeta({
          "og:title": "A short title",
          "og:description": "A description",
          "og:image": "https://example.com/card.png",
          "twitter:card": "summary_large_image",
        }),
        { status: 200 },
      ),
      new Response(null, { status: 200, headers: { "content-type": "text/html" } }),
    );

    const result = await runOgCheck({ url: "https://example.com" });
    expect(result.outcome).toBe("fail");
    expect(result.details.missing).toContain("og:image_type");
  });

  it("fails when the image exceeds 8MB per Content-Length", async () => {
    mockFetchSequence(
      new Response(
        htmlWithMeta({
          "og:title": "A short title",
          "og:description": "A description",
          "og:image": "https://example.com/card.png",
          "twitter:card": "summary_large_image",
        }),
        { status: 200 },
      ),
      new Response(null, {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "9000000" },
      }),
    );

    const result = await runOgCheck({ url: "https://example.com" });
    expect(result.outcome).toBe("fail");
    expect(result.details.missing).toContain("og:image_too_heavy");
  });
});
