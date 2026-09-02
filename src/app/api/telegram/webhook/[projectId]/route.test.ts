import { describe, expect, it, vi, beforeEach } from "vitest";

const { fromMock, afterMock, runBotCommandMock, sendBotMessageMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  afterMock: vi.fn((cb: () => unknown) => cb()),
  runBotCommandMock: vi.fn().mockResolvedValue("reply text"),
  sendBotMessageMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: afterMock };
});

vi.mock("@/lib/db/service", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/bot-commands", () => ({
  parseBotCommand: (text: string) => (text.startsWith("/") ? text.split(" ")[0] : "/help"),
  runBotCommand: runBotCommandMock,
  sendBotMessage: sendBotMessageMock,
}));

const { POST } = await import("./route");

const PROJECT = {
  id: "proj-1",
  telegram_webhook_secret: "correct-secret",
  telegram_bot_token: "123:abc",
  telegram_chat_id: "999",
  profiles: { plan: "solo" },
};

function mockProject(project: typeof PROJECT | null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: project }),
      }),
    }),
  });
}

function makeRequest(body: unknown, secretHeader: string | null) {
  return new Request("https://postship.fr/api/telegram/webhook/proj-1", {
    method: "POST",
    headers: secretHeader ? { "x-telegram-bot-api-secret-token": secretHeader } : {},
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fromMock.mockReset();
  afterMock.mockClear();
  runBotCommandMock.mockClear();
  sendBotMessageMock.mockClear();
});

describe("POST /api/telegram/webhook/[projectId]", () => {
  it("rejects a wrong secret with 401", async () => {
    mockProject(PROJECT);
    const request = makeRequest(
      { message: { chat: { id: 999 }, text: "/status" } },
      "wrong-secret",
    );

    const response = await POST(request, { params: Promise.resolve({ projectId: "proj-1" }) });

    expect(response.status).toBe(401);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("no-ops with 200 for a message from an unrecognized chat", async () => {
    mockProject(PROJECT);
    const request = makeRequest(
      { message: { chat: { id: 111 }, text: "/status" } },
      "correct-secret",
    );

    const response = await POST(request, { params: Promise.resolve({ projectId: "proj-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(afterMock).not.toHaveBeenCalled();
    expect(sendBotMessageMock).not.toHaveBeenCalled();
  });

  it("runs the command and replies for the configured chat with the right secret", async () => {
    mockProject(PROJECT);
    const request = makeRequest(
      { message: { chat: { id: 999 }, text: "/status" } },
      "correct-secret",
    );

    const response = await POST(request, { params: Promise.resolve({ projectId: "proj-1" }) });

    expect(response.status).toBe(200);
    expect(runBotCommandMock).toHaveBeenCalledWith("/status", expect.objectContaining({ projectId: "proj-1" }));
    expect(sendBotMessageMock).toHaveBeenCalled();
  });

  it("404s when the project has no webhook secret configured", async () => {
    mockProject({ ...PROJECT, telegram_webhook_secret: null as unknown as string });
    const request = makeRequest({ message: { chat: { id: 999 }, text: "/status" } }, "anything");

    const response = await POST(request, { params: Promise.resolve({ projectId: "proj-1" }) });
    expect(response.status).toBe(404);
  });
});
