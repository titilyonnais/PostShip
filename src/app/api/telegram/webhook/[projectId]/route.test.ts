import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  fromMock,
  afterMock,
  runBotCommandMock,
  sendBotMessageMock,
  updateMock,
  sendTelegramTextMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  afterMock: vi.fn((cb: () => unknown) => cb()),
  runBotCommandMock: vi.fn().mockResolvedValue("reply text"),
  sendBotMessageMock: vi.fn().mockResolvedValue(undefined),
  updateMock: vi.fn(),
  sendTelegramTextMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: afterMock };
});

vi.mock("@/lib/db/service", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegramText: sendTelegramTextMock,
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

type ProjectRow = Omit<typeof PROJECT, "telegram_chat_id"> & {
  telegram_chat_id: string | null;
};

function mockProject(project: ProjectRow | null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: project }),
      }),
    }),
    // The /start adoption path writes back the chat it was greeted from,
    // guarded by .is("telegram_chat_id", null) so a second /start can't
    // steal the channel from the first.
    update: (values: Record<string, unknown>) => {
      updateMock(values);
      return {
        eq: () => ({
          is: async () => ({ error: null }),
        }),
      };
    },
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
  updateMock.mockClear();
  sendTelegramTextMock.mockClear();
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
    expect(runBotCommandMock).toHaveBeenCalledWith(
      "/status",
      expect.objectContaining({ projectId: "proj-1" }),
      "/status",
    );
    expect(sendBotMessageMock).toHaveBeenCalled();
  });

  it("adopts the chat that sends the first /start when none is stored", async () => {
    mockProject({ ...PROJECT, telegram_chat_id: null });
    const request = makeRequest(
      { message: { chat: { id: 4242 }, text: "/start" } },
      "correct-secret",
    );

    const response = await POST(request, { params: Promise.resolve({ projectId: "proj-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, adopted: true });
    expect(updateMock).toHaveBeenCalledWith({ telegram_chat_id: "4242" });
    expect(sendTelegramTextMock).toHaveBeenCalledWith(
      "123:abc",
      4242,
      expect.stringContaining("connecté"),
    );
    // Adoption is not a command — nothing should run the bot here.
    expect(runBotCommandMock).not.toHaveBeenCalled();
  });

  it("waits for /start rather than adopting any passing message", async () => {
    mockProject({ ...PROJECT, telegram_chat_id: null });
    const request = makeRequest(
      { message: { chat: { id: 4242 }, text: "bonjour" } },
      "correct-secret",
    );

    const response = await POST(request, { params: Promise.resolve({ projectId: "proj-1" }) });

    expect(response.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
    expect(sendTelegramTextMock).not.toHaveBeenCalled();
  });

  it("stops adopting once a chat is stored", async () => {
    mockProject(PROJECT);
    const request = makeRequest(
      { message: { chat: { id: 4242 }, text: "/start" } },
      "correct-secret",
    );

    const response = await POST(request, { params: Promise.resolve({ projectId: "proj-1" }) });

    expect(response.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("404s when the project has no webhook secret configured", async () => {
    mockProject({ ...PROJECT, telegram_webhook_secret: null as unknown as string });
    const request = makeRequest({ message: { chat: { id: 999 }, text: "/status" } }, "anything");

    const response = await POST(request, { params: Promise.resolve({ projectId: "proj-1" }) });
    expect(response.status).toBe(404);
  });
});
