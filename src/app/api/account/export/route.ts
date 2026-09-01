import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const [{ data: profile }, { data: projects }, { data: targets }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "email, display_name, full_name, company_name, phone, team_size, locale, plan, billing_address, created_at",
        )
        .eq("id", user.id)
        .single(),
      supabase
        .from("projects")
        .select("id, name, base_url, created_at, paused"),
      supabase
        .from("check_targets")
        .select("id, project_id, url, kind, expect_status, enabled, created_at"),
    ]);

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      profile,
      projects,
      check_targets: targets,
    },
    null,
    2,
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="postship-export-${user.id}.json"`,
    },
  });
}
