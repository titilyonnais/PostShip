import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns", () => ({
  promises: { lookup: lookupMock },
}));

const { runHttpCheck } = await import("./http");

function mockPage(html: string) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    );
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

describe("runHttpCheck — money path assertions", () => {
  it("fails with stripe_js when requireStripeJs and js.stripe.com is absent", async () => {
    mockPage("<html><body>Checkout</body></html>");
    const result = await runHttpCheck({
      url: "https://example.com/checkout",
      expect_status: 200,
      expect_contains: null,
      expect_not_contains: null,
      assertions: { requireStripeJs: true },
    });
    expect(result.outcome).toBe("fail");
    expect(result.details.missing).toContain("stripe_js");
  });

  it("passes requireStripeJs when js.stripe.com is present", async () => {
    mockPage('<html><body><script src="https://js.stripe.com/v3/"></script></body></html>');
    const result = await runHttpCheck({
      url: "https://example.com/checkout",
      expect_status: 200,
      expect_contains: null,
      expect_not_contains: null,
      assertions: { requireStripeJs: true },
    });
    expect(result.outcome).toBe("pass");
  });

  it("passes requireEmailOrPasswordInput via an email input", async () => {
    mockPage('<html><body><input type="email" name="email"></body></html>');
    const result = await runHttpCheck({
      url: "https://example.com/login",
      expect_status: 200,
      expect_contains: null,
      expect_not_contains: null,
      assertions: { requireEmailOrPasswordInput: true },
    });
    expect(result.outcome).toBe("pass");
  });

  it("passes requireEmailOrPasswordInput via a 'Connexion' link with no form input", async () => {
    mockPage('<html><body><a href="/auth/github">Connexion avec GitHub</a></body></html>');
    const result = await runHttpCheck({
      url: "https://example.com/login",
      expect_status: 200,
      expect_contains: null,
      expect_not_contains: null,
      assertions: { requireEmailOrPasswordInput: true },
    });
    expect(result.outcome).toBe("pass");
  });

  it("fails login_form when neither an input nor an auth link is present", async () => {
    mockPage("<html><body>Nothing here.</body></html>");
    const result = await runHttpCheck({
      url: "https://example.com/login",
      expect_status: 200,
      expect_contains: null,
      expect_not_contains: null,
      assertions: { requireEmailOrPasswordInput: true },
    });
    expect(result.outcome).toBe("fail");
    expect(result.details.missing).toContain("login_form");
  });

  it("fails price_token when the token is absent", async () => {
    mockPage("<html><body>No price shown.</body></html>");
    const result = await runHttpCheck({
      url: "https://example.com/pricing",
      expect_status: 200,
      expect_contains: null,
      expect_not_contains: null,
      assertions: { requirePriceToken: "€" },
    });
    expect(result.outcome).toBe("fail");
    expect(result.details.missing).toContain("price_token");
  });

  it("passes with no assertions set", async () => {
    mockPage("<html><body>Plain page.</body></html>");
    const result = await runHttpCheck({
      url: "https://example.com/",
      expect_status: 200,
      expect_contains: null,
      expect_not_contains: null,
      assertions: null,
    });
    expect(result.outcome).toBe("pass");
  });
});
