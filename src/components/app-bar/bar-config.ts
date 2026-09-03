// B2 (app-bar backlog): pure pathname -> {title, actions} mapper. The bar
// component contains no routing/business logic of its own — it only
// renders what this returns, then wires each action's `action` id to the
// matching server action (project-bar.tsx).

export type BarActionKind =
  | "runNow"
  | "runTargetNow"
  | "silence1h"
  | "recomputeHealth"
  | "copyStatus";

export type BarAction = {
  id: string;
  label: string;
  // Project-relative — the component prefixes it with /app/{projectId}.
  href?: string;
  action?: BarActionKind;
};

export type BarSpec = { title: string; actions: BarAction[] };

const APERCU_SPEC: BarSpec = {
  title: "Aperçu",
  actions: [{ id: "runNow", label: "Lancer maintenant", action: "runNow" }],
};

const TARGET_DETAIL_SPEC: BarSpec = {
  title: "URL",
  actions: [{ id: "runNow", label: "Lancer maintenant", action: "runTargetNow" }],
};

const KNOWN_SEGMENT_SPECS: Record<string, BarSpec> = {
  deploys: {
    title: "Déplois",
    actions: [{ id: "runNow", label: "Relancer", action: "runNow" }],
  },
  incidents: {
    title: "Incidents",
    actions: [{ id: "silence1h", label: "Couper 1 h", action: "silence1h" }],
  },
  urls: {
    title: "URLs",
    actions: [{ id: "addUrl", label: "Ajouter une URL", href: "/urls?add=1" }],
  },
  health: {
    title: "Santé",
    actions: [{ id: "recomputeHealth", label: "Recalculer", action: "recomputeHealth" }],
  },
  share: {
    title: "Partage",
    actions: [{ id: "copyStatus", label: "Copier le statut", action: "copyStatus" }],
  },
  scans: { title: "Scans", actions: [] },
  integrations: { title: "Intégrations", actions: [] },
  settings: { title: "Paramètres", actions: [] },
};

// Given a full pathname (e.g. "/app/abc123/deploys"), returns the bar spec
// for whatever's at the project-relative segment. Anything one level below
// the project root that isn't a known segment is a target-detail page
// (/app/[projectId]/[targetId]) — ids are opaque, so "unrecognized segment
// present" is what identifies it, not a specific known value.
export function getProjectBarSpec(pathname: string): BarSpec {
  const segments = pathname.split("/").filter(Boolean); // ["app", projectId, segment?, ...]
  const segment = segments[2];

  if (!segment) return APERCU_SPEC;
  if (segment in KNOWN_SEGMENT_SPECS) return KNOWN_SEGMENT_SPECS[segment];
  return TARGET_DETAIL_SPEC;
}
