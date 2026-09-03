import type { HeatmapDay } from "@/lib/reliability";

function squareClass(day: HeatmapDay): string {
  if (day.totalRuns === 0) return "bg-neutral-800";
  if (day.failRuns > 0) return "bg-red-500";
  return "bg-emerald-500";
}

function squareTitle(day: HeatmapDay): string {
  const label = new Date(`${day.date}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  if (day.totalRuns === 0) return `${label} · pas de vérification`;
  return `${label} · ${day.failRuns} échec${day.failRuns > 1 ? "s" : ""} / ${day.totalRuns}`;
}

export function ReliabilityHeatmap({
  heatmap,
  mttrMinutes,
  incidents30d,
}: {
  heatmap: HeatmapDay[];
  mttrMinutes: number | null;
  incidents30d: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Fiabilité — 30 jours
        </h2>
        <p className="text-xs text-muted-foreground">
          {incidents30d} incident{incidents30d > 1 ? "s" : ""} · MTTR{" "}
          {mttrMinutes === null ? "—" : `${Math.round(mttrMinutes)} min`}
        </p>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {heatmap.map((day) => (
          <span
            key={day.date}
            title={squareTitle(day)}
            className={`aspect-square rounded-sm ${squareClass(day)}`}
          />
        ))}
      </div>
    </div>
  );
}
