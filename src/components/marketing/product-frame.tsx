// S4 (site backlog): a Vercel-style "product window" mock — CSS only, no
// screenshot, no iframe onto the real /app. Illustrative, not live data:
// every instance is wrapped with role="img" + aria-label and its insides
// are aria-hidden, same treatment as the terminal mock it replaces on the
// home hero.
//
// Feedback fix: the outer frame is rounded-xl (12px), not the rounded-3xl
// the app's own cards and dialogs use. This is meant to read as a real
// application window sitting on the page — a 24px radius on something
// this large looks like a sticker, not a screen. Rows inside step down to
// rounded-lg so the nesting stays natural.

const HEATMAP_SQUARES = Array.from({ length: 30 }, (_, i) => {
  if (i === 14) return "amber";
  if (i < 10) return "green";
  return "muted";
});

const HEATMAP_SQUARE_CLASS: Record<string, string> = {
  green: "bg-[#3fb950]",
  amber: "bg-[#d29922]",
  muted: "bg-neutral-800",
};

function Chip({
  tone,
  children,
}: {
  tone: "red" | "neutral" | "green";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "red"
      ? "bg-destructive/10 text-destructive"
      : tone === "green"
        ? "bg-[#3fb950]/15 text-[#3fb950]"
        : "bg-muted text-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export function ProductFrame({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.02)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
    >
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2" aria-hidden="true">
        <span className="size-2 rounded-full bg-[#f85149]" />
        <span className="size-2 rounded-full bg-[#d29922]" />
        <span className="size-2 rounded-full bg-[#3fb950]" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">{title}</span>
      </div>
      <div className="flex flex-col gap-4 p-4" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

// The Aperçu page: ship score + 30-day heatmap + one incident sliding in —
// the same shapes real /app/[projectId] renders (Ship Score, Fiabilité
// heatmap, incident rows), reconstructed here as static markup.
export function ApercuFrame({ projectLabel = "acme" }: { projectLabel?: string }) {
  return (
    <ProductFrame
      title={`${projectLabel} — Aperçu`}
      label="Aperçu d'un projet PostShip : 3 incidents, Ship Score 85 avec −15 pour la carte Open Graph, une heatmap de fiabilité sur 30 jours, une alerte og:image en 404"
    >
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="red">3 incidents</Chip>
        <Chip tone="neutral">Ship 85</Chip>
        <Chip tone="green">Bot OK</Chip>
      </div>
      <div>
        <p className="font-mono text-4xl font-semibold tracking-tight">85</p>
        <p className="text-xs text-muted-foreground">−15 carte OG</p>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {HEATMAP_SQUARES.map((tone, index) => (
          <span
            key={index}
            className={`aspect-square rounded-sm ${HEATMAP_SQUARE_CLASS[tone]}`}
          />
        ))}
      </div>
      <div
        className="flex items-center gap-2 border-t border-border pt-3 text-xs text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1"
        style={{ animationDelay: "500ms" }}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-[#f85149]" />
        og:image · 404
      </div>
    </ProductFrame>
  );
}

const INCIDENT_ROWS = [
  { url: "/checkout", detail: "og:image · 404" },
  { url: "/pricing", detail: "prix absent" },
  { url: "sitemap.xml", detail: "3 URLs en échec" },
];

// The Incidents page: what's failing right now, one row per line — same
// shape as /app/[projectId]/incidents.
export function IncidentsFrame({ projectLabel = "acme" }: { projectLabel?: string }) {
  return (
    <ProductFrame
      title={`${projectLabel} — Incidents`}
      label="Page Incidents d'un projet PostShip : 3 URLs en échec en ce moment, avec le détail de chaque échec"
    >
      <div className="flex flex-col gap-1.5">
        {INCIDENT_ROWS.map((row, index) => (
          <div
            key={row.url}
            className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="flex items-center gap-2 font-mono text-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-[#f85149]" />
              {row.url}
            </span>
            <span className="text-destructive">{row.detail}</span>
          </div>
        ))}
      </div>
    </ProductFrame>
  );
}

// The Déplois page: T+0 / T+2 / T+8 re-checks after a production deploy —
// same shape as /app/[projectId]/deploys.
export function DeploysFrame({ projectLabel = "acme" }: { projectLabel?: string }) {
  return (
    <ProductFrame
      title={`${projectLabel} — Déplois`}
      label="Page Déplois d'un projet PostShip : dernier déploiement Vercel, vérifié à T+0, T+2 et T+8 minutes, tout au vert"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-3 py-2 text-xs">
          <span className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-[#3fb950]" />
            <span className="font-medium">Vercel</span>
            <span className="font-mono text-muted-foreground">a1b2c3d</span>
          </span>
          <span className="text-muted-foreground">il y a 3 min</span>
        </div>
        <p className="pl-1 font-mono text-[0.7rem] text-muted-foreground">
          T+0 OK · T+2 OK · T+8 OK
        </p>
      </div>
    </ProductFrame>
  );
}
