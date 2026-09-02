import { createServiceClient } from "@/lib/db/service";

// Opt-in only (see CLAUDE.md's "public status pages" exception) — a
// single pass/fail SVG, nothing else. No history, no URL list, no
// incident log, 404 unless the owner has explicitly turned this on
// (projects.badge_public, migration 0034).
export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Fixed 140x20, shields.io-style — "PostShip | passing/failing/pending".
const WIDTH = 140;
const LABEL_WIDTH = 62;
const MESSAGE_WIDTH = WIDTH - LABEL_WIDTH;

function buildBadgeSvg(label: string, message: string, color: string): string {
  const labelWidth = LABEL_WIDTH;
  const messageWidth = MESSAGE_WIDTH;
  const width = WIDTH;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(message)}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${width}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${escapeXml(label)}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${escapeXml(message)}</text>
  </g>
</svg>`;
}

function svgResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("last_status, badge_public")
    .eq("id", projectId)
    .single();

  if (!project?.badge_public) {
    return new Response("Not found", { status: 404 });
  }

  const status = project.last_status as "pass" | "fail" | null;
  const message = status === "pass" ? "passing" : status === "fail" ? "failing" : "pending";
  const color = status === "pass" ? "#3fb950" : status === "fail" ? "#f85149" : "#9e9e9e";

  return svgResponse(buildBadgeSvg("PostShip", message, color));
}
