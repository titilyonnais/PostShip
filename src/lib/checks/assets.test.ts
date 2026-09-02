import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns", () => ({
  promises: { lookup: lookupMock },
}));

const { checkAssets } = await import("./assets");

function mockFetchByUrl(responses: Record<string, Response>) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const response = responses[url];
    if (!response) return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    return Promise.resolve(response);
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

describe("checkAssets", () => {
  it("ignores a 401 on an asset instead of flagging it broken (F6)", async () => {
    mockFetchByUrl({
      "https://example.com/app.js": new Response(null, { status: 401 }),
    });

    const html = `<html><body><script src="/app.js"></script></body></html>`;
    const result = await checkAssets(html, "https://example.com/", new AbortController().signal);

    expect(result.missing).toEqual([]);
    expect(result.brokenAssets).toEqual([]);
  });


  it("flags a same-origin script that 404s", async () => {
    mockFetchByUrl({
      "https://example.com/app.js": new Response(null, { status: 404 }),
    });

    const html = `<html><body><script src="/app.js"></script></body></html>`;
    const result = await checkAssets(html, "https://example.com/", new AbortController().signal);

    expect(result.missing).toEqual(["asset:404:/app.js"]);
    expect(result.brokenAssets).toEqual([
      { url: "https://example.com/app.js", status: 404, contentType: null },
    ]);
  });

  it("ignores a script from a different origin", async () => {
    const fetchMock = mockFetchByUrl({});

    const html = `<html><body><script src="https://js.stripe.com/v3/"></script></body></html>`;
    const result = await checkAssets(html, "https://example.com/", new AbortController().signal);

    expect(result.missing).toEqual([]);
    expect(result.brokenAssets).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes when there are no same-origin assets", async () => {
    const fetchMock = mockFetchByUrl({});

    const html = `<html><body>No assets here.</body></html>`;
    const result = await checkAssets(html, "https://example.com/", new AbortController().signal);

    expect(result.missing).toEqual([]);
    expect(result.brokenAssets).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to GET when HEAD returns 405", async () => {
    mockFetchByUrl({
      "https://example.com/app.js": new Response(null, { status: 405 }),
    });
    const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init?.method === "HEAD") return Promise.resolve(new Response(null, { status: 405 }));
      return Promise.resolve(new Response("ok", { status: 200, headers: { "content-type": "application/javascript" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const html = `<html><body><script src="/app.js"></script></body></html>`;
    const result = await checkAssets(html, "https://example.com/", new AbortController().signal);

    expect(result.missing).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("flags a JS file served as an HTML error page", async () => {
    mockFetchByUrl({
      "https://example.com/app.js": new Response(null, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    });

    const html = `<html><body><link rel="stylesheet" href="/style.css"><script src="/app.js"></script></body></html>`;
    const result = await checkAssets(html, "https://example.com/", new AbortController().signal);

    // Only /app.js was mocked — /style.css hits the "Unexpected fetch"
    // rejection path, which the implementation must treat as broken too.
    expect(result.missing).toContain("asset:200:/app.js");
  });
});
