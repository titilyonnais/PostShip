import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns", () => ({
  promises: { lookup: lookupMock },
}));

const { guardedFetch } = await import("./shared");

beforeEach(() => {
  lookupMock.mockReset();
  lookupMock.mockResolvedValue([{ address: "93.184.216.34" }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guardedFetch — extraHeaders (F6)", () => {
  it("sends extraHeaders to the original host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await guardedFetch("https://example.com/private", {
      signal: new AbortController().signal,
      extraHeaders: { Authorization: "Bearer secret" },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer secret");
  });

  it("does not forward extraHeaders to a redirect target on a different host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://other.example.com/landed" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await guardedFetch("https://example.com/private", {
      signal: new AbortController().signal,
      extraHeaders: { Authorization: "Bearer secret" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, firstInit] = fetchMock.mock.calls[0];
    const [, secondInit] = fetchMock.mock.calls[1];
    expect(firstInit.headers.Authorization).toBe("Bearer secret");
    expect(secondInit.headers.Authorization).toBeUndefined();
  });
});
