import { describe, expect, it } from "vitest";
import {
  buildDiscordPayload,
  buildSlackPayload,
  summarizeChatAlert,
  type ChatAlertItem,
} from "./chat-alerts";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";

function failItem(overrides: Partial<ChatAlertItem> = {}): ChatAlertItem {
  return {
    targetId: "t1",
    url: "https://acme.com/checkout",
    kind: "fail",
    outcome: "fail",
    httpStatus: 500,
    ttfbMs: 120,
    checkKind: "http",
    ...overrides,
  };
}

describe("summarizeChatAlert", () => {
  it("treats a mixed batch as a failure", () => {
    const summary = summarizeChatAlert([
      failItem(),
      failItem({ targetId: "t2", kind: "recovered" }),
    ]);
    expect(summary.tone).toBe("fail");
    expect(summary.headline).toBe("1 URL en échec");
    expect(summary.recap).toContain("1 rétabli");
  });

  it("pluralises and mentions the deploy when there is a hint", () => {
    const summary = summarizeChatAlert([
      failItem({ deployHint: "abc1234" }),
      failItem({ targetId: "t2" }),
    ]);
    expect(summary.headline).toBe("2 URLs en échec");
    expect(summary.recap).toContain("abc1234");
  });
});

describe("buildDiscordPayload", () => {
  it("colors the embed by tone and links the project", () => {
    const payload = buildDiscordPayload("p1", "Acme", [failItem()]) as never as {
      embeds: { color: number; url: string; fields: { name: string; value: string }[] }[];
    };
    const embed = payload.embeds[0];
    expect(embed.color).toBe(0xf85149);
    expect(embed.url).toBe(`${APP_URL}/app/p1`);
    expect(embed.fields[0].value).toContain(`${APP_URL}/app/p1/t1`);
    expect(embed.fields[0].value).toContain("HTTP 500");
  });

  it("spells out every missing code", () => {
    const payload = buildDiscordPayload("p1", "Acme", [
      failItem({ httpStatus: 200, missing: ["stripe_js", "price_token"] }),
    ]) as never as { embeds: { fields: { value: string }[] }[] };
    const value = payload.embeds[0].fields[0].value;
    expect(value).toContain("Stripe.js");
    expect(value).toContain("prix");
  });

  it("caps the field count and says how many were left out", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      failItem({ targetId: `t${i}`, url: `https://acme.com/${i}` }),
    );
    const payload = buildDiscordPayload("p1", "Acme", items) as never as {
      embeds: { fields: { value: string }[] }[];
    };
    const fields = payload.embeds[0].fields;
    // 8 items + the trailing links field.
    expect(fields).toHaveLength(9);
    expect(fields[8].value).toContain("+4 autres");
  });
});

describe("buildSlackPayload", () => {
  it("keeps a plain-text fallback alongside the blocks", () => {
    const payload = buildSlackPayload("p1", "Acme", [failItem()]) as never as {
      text: string;
      blocks: { type: string }[];
    };
    expect(payload.text).toContain("Acme");
    expect(payload.blocks[0].type).toBe("header");
  });

  it("ends on link buttons, red when something is failing", () => {
    const payload = buildSlackPayload("p1", "Acme", [failItem()]) as never as {
      blocks: { type: string; elements?: { url?: string; style?: string }[] }[];
    };
    const actions = payload.blocks[payload.blocks.length - 1];
    expect(actions.type).toBe("actions");
    expect(actions.elements?.[0].url).toBe(`${APP_URL}/app/p1`);
    expect(actions.elements?.[0].style).toBe("danger");
  });

  it("drops the red style once everything is recovered", () => {
    const payload = buildSlackPayload("p1", "Acme", [
      failItem({ kind: "recovered" }),
    ]) as never as { blocks: { type: string; elements?: { style?: string }[] }[] };
    const actions = payload.blocks[payload.blocks.length - 1];
    expect(actions.elements?.[0].style).toBeUndefined();
  });
});
