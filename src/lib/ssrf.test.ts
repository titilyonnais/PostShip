import { describe, expect, it, vi, beforeEach } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns", () => ({
  promises: { lookup: lookupMock },
}));

// Imported after the mock so assertPublicHttpsUrl picks up the mocked dns.
const { assertPublicHttpsUrl } = await import("./ssrf");

function mockDns(addresses: string[]) {
  lookupMock.mockResolvedValue(addresses.map((address) => ({ address })));
}

beforeEach(() => {
  lookupMock.mockReset();
});

describe("assertPublicHttpsUrl", () => {
  it("rejects non-https protocols", async () => {
    const result = await assertPublicHttpsUrl("http://example.com");
    expect(result.ok).toBe(false);
  });

  it("rejects an unparsable URL", async () => {
    const result = await assertPublicHttpsUrl("not a url");
    expect(result.ok).toBe(false);
  });

  it.each([
    ["127.0.0.1", "loopback"],
    ["10.0.0.5", "RFC1918 10/8"],
    ["172.16.0.1", "RFC1918 172.16/12"],
    ["172.31.255.255", "RFC1918 172.16/12 upper bound"],
    ["192.168.1.1", "RFC1918 192.168/16"],
    ["169.254.169.254", "cloud metadata (link-local)"],
    ["169.254.0.1", "link-local"],
    ["100.64.0.1", "carrier-grade NAT"],
    ["0.0.0.0", "this network"],
  ])("rejects a literal IPv4 target %s (%s)", async (ip) => {
    const result = await assertPublicHttpsUrl(`https://${ip}/`);
    expect(result.ok).toBe(false);
  });

  it("rejects the IPv6 loopback literal", async () => {
    const result = await assertPublicHttpsUrl("https://[::1]/");
    expect(result.ok).toBe(false);
  });

  it("rejects an IPv6 link-local literal", async () => {
    const result = await assertPublicHttpsUrl("https://[fe80::1]/");
    expect(result.ok).toBe(false);
  });

  it("rejects an IPv6 unique-local literal", async () => {
    const result = await assertPublicHttpsUrl("https://[fd00::1]/");
    expect(result.ok).toBe(false);
  });

  it("rejects an IPv4-mapped IPv6 literal that maps to a private address", async () => {
    const result = await assertPublicHttpsUrl("https://[::ffff:127.0.0.1]/");
    expect(result.ok).toBe(false);
  });

  it("accepts a literal public IPv4 address", async () => {
    const result = await assertPublicHttpsUrl("https://93.184.216.34/");
    expect(result.ok).toBe(true);
  });

  it("rejects .internal and .local hostnames without a DNS lookup", async () => {
    expect((await assertPublicHttpsUrl("https://foo.internal/")).ok).toBe(false);
    expect((await assertPublicHttpsUrl("https://foo.local/")).ok).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects the localhost hostname without a DNS lookup", async () => {
    expect((await assertPublicHttpsUrl("https://localhost/")).ok).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to a private address", async () => {
    mockDns(["10.0.0.1"]);
    const result = await assertPublicHttpsUrl("https://internal.example.com/");
    expect(result.ok).toBe(false);
  });

  // The exact "resolves publicly then gets rebound" DNS-rebinding gap is a
  // documented, accepted limitation (see the comment in ssrf.ts) — this
  // pins the behavior this check *is* meant to catch: any resolved address
  // being private fails the whole lookup, even if only one of several is.
  it("rejects a hostname with mixed public/private resolved addresses", async () => {
    mockDns(["93.184.216.34", "127.0.0.1"]);
    const result = await assertPublicHttpsUrl("https://mixed.example.com/");
    expect(result.ok).toBe(false);
  });

  it("accepts a hostname that resolves only to public addresses", async () => {
    mockDns(["93.184.216.34"]);
    const result = await assertPublicHttpsUrl("https://example.com/");
    expect(result.ok).toBe(true);
  });

  it("rejects a hostname that fails to resolve", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    const result = await assertPublicHttpsUrl("https://does-not-exist.invalid/");
    expect(result.ok).toBe(false);
  });
});
