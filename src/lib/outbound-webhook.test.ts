import { describe, expect, it } from "vitest";
import { signOutboundWebhookBody } from "./outbound-webhook";

describe("signOutboundWebhookBody", () => {
  it("is deterministic for the same body and secret", () => {
    const body = JSON.stringify({ event: "fail", items: [] });
    const a = signOutboundWebhookBody("s3cret", body);
    const b = signOutboundWebhookBody("s3cret", body);
    expect(a).toBe(b);
  });

  it("changes when the body changes", () => {
    const a = signOutboundWebhookBody("s3cret", JSON.stringify({ event: "fail" }));
    const b = signOutboundWebhookBody("s3cret", JSON.stringify({ event: "recovered" }));
    expect(a).not.toBe(b);
  });

  it("changes when the secret changes", () => {
    const body = JSON.stringify({ event: "fail" });
    const a = signOutboundWebhookBody("secret-one", body);
    const b = signOutboundWebhookBody("secret-two", body);
    expect(a).not.toBe(b);
  });

  it("matches a known HMAC-SHA256 vector", () => {
    const signature = signOutboundWebhookBody("topsecret", '{"a":1}');
    expect(signature).toBe(
      "bf1e6501b7fa928ec2391fea9dd90af3c9ad1b7b1ef6ff319c25940cec746bf8",
    );
  });
});
