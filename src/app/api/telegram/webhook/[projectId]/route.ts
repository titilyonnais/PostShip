import { timingSafeEqual } from "node:crypto";
import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { parseBotCommand, runBotCommand, sendBotMessage } from "@/lib/bot-commands";
import { getPlanLimits, type Plan } from "@/lib/entitlements";

// M3b (menu backlog): the real, interactive Telegram bot. Commands land
// here as Telegram's own Update webhook, not a new outbound channel —
// setTelegramWebhook (bot-actions.ts) points Telegram at this URL and
// hands it the secret_token checked below.
function isValidSecret(expected: string, header: string | null): boolean {
  if (!header) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const header = request.headers.get("x-telegram-bot-api-secret-token");

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, telegram_webhook_secret, telegram_bot_token, telegram_chat_id, profiles(plan)",
    )
    .eq("id", projectId)
    .single();

  if (!project?.telegram_webhook_secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  if (!isValidSecret(project.telegram_webhook_secret, header)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let body: { message?: { chat?: { id?: number | string }; text?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatId = body.message?.chat?.id;
  const text = body.message?.text;

  // A stranger talking to the bot (wrong chat) is a silent no-op — the bot
  // is only ever meant to answer in the one chat the owner configured.
  if (chatId === undefined || String(chatId) !== project.telegram_chat_id || !text) {
    return NextResponse.json({ ok: true });
  }

  const owner = project.profiles as unknown as { plan: Plan } | null;
  if (!getPlanLimits(owner?.plan ?? "free").chatWebhooks) {
    return NextResponse.json({ ok: true });
  }

  // Respond to Telegram immediately — the reply itself is a separate
  // sendMessage call, not part of this webhook's own response, and /check
  // can take a few seconds (it runs the project's checks synchronously).
  after(async () => {
    const command = parseBotCommand(text);
    const reply = await runBotCommand(command, { supabase, projectId });
    await sendBotMessage(
      {
        discord_webhook_url: null,
        telegram_bot_token: project.telegram_bot_token,
        telegram_chat_id: project.telegram_chat_id,
      },
      reply,
    );
  });

  return NextResponse.json({ ok: true });
}
