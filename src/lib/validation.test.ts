import { describe, expect, it, vi, beforeEach } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns", () => ({
  promises: { lookup: lookupMock },
}));

// Imported after the mock so assertRegisterableHttpsUrl (via ssrf.ts)
// picks up the mocked dns.
const { assertRegisterableHttpsUrl } = await import("./validation");

function mockDns(addresses: string[]) {
  lookupMock.mockResolvedValue(addresses.map((address) => ({ address })));
}

beforeEach(() => {
  lookupMock.mockReset();
});

describe("assertRegisterableHttpsUrl", () => {
  it("accepts a public https URL", async () => {
    mockDns(["93.184.216.34"]);
    const result = await assertRegisterableHttpsUrl("https://example.com/path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe("https://example.com/path");
    }
  });

  it("rejects http", async () => {
    const result = await assertRegisterableHttpsUrl("http://example.com");
    expect(result.ok).toBe(false);
  });

  it("rejects a loopback IP literal", async () => {
    const result = await assertRegisterableHttpsUrl("https://127.0.0.1/");
    expect(result.ok).toBe(false);
  });

  it("rejects the cloud metadata IP literal", async () => {
    const result = await assertRegisterableHttpsUrl("https://169.254.169.254/");
    expect(result.ok).toBe(false);
  });

  it("rejects localhost", async () => {
    const result = await assertRegisterableHttpsUrl("https://localhost/");
    expect(result.ok).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects userinfo in the URL", async () => {
    const result = await assertRegisterableHttpsUrl(
      "https://user:pass@example.com/",
    );
    expect(result.ok).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects .internal hostnames", async () => {
    const result = await assertRegisterableHttpsUrl("https://foo.internal/");
    expect(result.ok).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects an unparsable URL", async () => {
    const result = await assertRegisterableHttpsUrl("not a url");
    expect(result.ok).toBe(false);
  });
});
