"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Copy, Menu, MoreHorizontal, Play, Plus, RotateCw } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { ActionForm } from "@/components/action-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statusDotClass, statusLabel } from "@/lib/status";
import { useActiveProject, type Project } from "@/lib/use-active-project";
import { cn } from "@/lib/utils";
import { ACCOUNT_TABS } from "@/components/sidebar/nav-config";
import {
  recomputeHealthNow,
  runProjectNow,
  runTargetNow,
  silenceAlerts,
} from "@/app/(app)/app/[projectId]/actions";
import { type BarAction, getProjectBarSpec } from "./bar-config";

const ACTION_BUTTON_CLASS = "h-10 rounded-full md:h-8";

function isProjectSilenced(project: Project): boolean {
  return !!project.alerts_silenced_until && new Date(project.alerts_silenced_until).getTime() > Date.now();
}

function accountBarTitle(pathname: string): string {
  if (pathname === "/app/billing") return "Abonnement";
  // Every real /app/account/* route is an exact match for one
  // ACCOUNT_TABS href — no prefix matching needed (and no prefix
  // matching wanted: "/app/account" itself is a prefix of every other
  // tab's href, so a startsWith check here would always resolve to
  // "Vue d'ensemble").
  const tab = ACCOUNT_TABS.find((t) => pathname === t.href);
  return tab?.label ?? "Vue d'ensemble";
}

function ProjectSwitcher({
  projects,
  activeProject,
}: {
  projects: Project[];
  activeProject: Project;
}) {
  const others = projects.filter((p) => p.id !== activeProject.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Projet actif, changer de projet"
            // Grid items stretch to fill their track by default — without
            // this, the switcher matches the desktop bar's whole 1fr
            // column width instead of its own content (found live: ~45%
            // of the bar). w-fit is a no-op in the mobile flex row, where
            // it's already content-sized.
            className="flex w-fit min-w-0 items-center gap-2 justify-self-start rounded-full px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", statusDotClass(activeProject.last_status))}
          aria-hidden="true"
        />
        <span className="sr-only">{statusLabel(activeProject.last_status)}</span>
        <span className="min-w-0 truncate text-sm font-medium">{activeProject.name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {others.length > 0 && (
          <>
            {others.map((p) => (
              <DropdownMenuItem key={p.id} render={<Link href={`/app/${p.id}`} />}>
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", statusDotClass(p.last_status))}
                  aria-hidden="true"
                />
                <span className="sr-only">{statusLabel(p.last_status)}</span>
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem render={<Link href="/app" />}>Tous les projets</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app" />}>
          <Plus className="size-3.5" aria-hidden="true" />
          Nouveau projet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function copyPageStatus() {
  const el = document.querySelector<HTMLElement>("[data-copy-status-text]");
  const text = el?.dataset.copyStatusText;
  if (!text) {
    toast.error("Rien à copier depuis cette page.");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => toast.success("Statut copié."),
    () => toast.error("Impossible de copier le statut."),
  );
}

// B3 (app-bar backlog): turns one BarAction into a real control, wired to
// the same server actions the page bodies already use (no new client
// fetches). `runNow` needs a targetId only for the target-detail page —
// segments[2] there is the target's id, since it isn't a known segment.
function ActionControl({
  action,
  project,
  pathname,
  canWrite,
  mobile,
}: {
  action: BarAction;
  project: Project;
  pathname: string;
  canWrite: boolean;
  mobile?: boolean;
}) {
  const className = cn(ACTION_BUTTON_CLASS, mobile && "w-full justify-center");

  if (action.href) {
    return (
      <Link
        href={`/app/${project.id}${action.href}`}
        className={cn(buttonVariants({ variant: "outline" }), className)}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {action.label}
      </Link>
    );
  }

  if (action.action === "copyStatus") {
    return (
      <Button type="button" variant="outline" className={className} onClick={copyPageStatus}>
        <Copy className="size-3.5" aria-hidden="true" />
        {action.label}
      </Button>
    );
  }

  if (action.action === "recomputeHealth") {
    return (
      <ActionForm action={recomputeHealthNow.bind(null, project.id)}>
        <SubmitButton
          variant="outline"
          pendingText="Recalcul..."
          disabled={!canWrite}
          title={canWrite ? undefined : "Réservé aux membres du projet"}
          className={className}
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          {action.label}
        </SubmitButton>
      </ActionForm>
    );
  }

  if (action.action === "silence1h") {
    const silenced = isProjectSilenced(project);
    return (
      <ActionForm action={silenceAlerts.bind(null, project.id, silenced ? 0 : 1)}>
        <SubmitButton
          variant="outline"
          pendingText="..."
          disabled={!canWrite}
          title={canWrite ? undefined : "Réservé aux membres du projet"}
          className={className}
        >
          {silenced ? "Reprendre" : action.label}
        </SubmitButton>
      </ActionForm>
    );
  }

  if (action.action === "runTargetNow") {
    const targetId = pathname.split("/").filter(Boolean)[2];
    return (
      <ActionForm action={runTargetNow.bind(null, project.id, targetId ?? "")}>
        <SubmitButton
          pendingText="Vérification..."
          disabled={!canWrite}
          title={canWrite ? undefined : "Réservé aux membres du projet"}
          className={className}
        >
          <Play className="size-3.5" aria-hidden="true" />
          {action.label}
        </SubmitButton>
      </ActionForm>
    );
  }

  // action.action === "runNow"
  return (
    <ActionForm action={runProjectNow.bind(null, project.id)}>
      <SubmitButton
        pendingText="Vérification..."
        disabled={!canWrite}
        title={canWrite ? undefined : "Réservé aux membres du projet"}
        className={className}
      >
        <Play className="size-3.5" aria-hidden="true" />
        {action.label}
      </SubmitButton>
    </ActionForm>
  );
}

function ActionSlot({
  actions,
  project,
  pathname,
  canWrite,
  mobile,
}: {
  actions: BarAction[];
  project: Project;
  pathname: string;
  canWrite: boolean;
  mobile?: boolean;
}) {
  if (actions.length === 0) return null;

  const [primary, ...rest] = actions;

  return (
    <div className="flex items-center gap-2">
      <ActionControl
        action={primary}
        project={project}
        pathname={pathname}
        canWrite={canWrite}
        mobile={mobile}
      />
      {/* Never more than one visible action on mobile — anything past the
          first goes in an overflow menu (bar-config never emits more than
          one today, but the rule is enforced structurally, not by luck). */}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" aria-label="Plus d'actions" className="size-10 rounded-full md:size-8" />
            }
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {rest.map((action) => (
              <DropdownMenuItem key={action.id} nativeButton={false}>
                <ActionControl
                  action={action}
                  project={project}
                  pathname={pathname}
                  canWrite={canWrite}
                  mobile
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function ProjectBar({
  projects,
  onOpenMobile,
}: {
  projects: Project[];
  onOpenMobile: () => void;
}) {
  const pathname = usePathname();
  const { project: activeProject } = useActiveProject(projects);

  const isAccountArea = pathname.startsWith("/app/account") || pathname === "/app/billing";

  // Every project in this list is already RLS-visible to the current
  // viewer (owner or collaborator) — see getUserProjects — and a
  // collaborator has write access to a project's operational surface
  // (URLs, alerts, webhooks) per the Équipe/Team-tab model, just not
  // billing or danger-zone. None of the bar's actions touch those, so
  // "in the list" already implies "can act on it".
  const canWrite = !!activeProject;

  if (isAccountArea) {
    const title = accountBarTitle(pathname);
    const showChangePlan = pathname === "/app/account/billing";

    return (
      <div className="fixed top-0 right-0 left-0 z-30 h-14 border-b bg-background/80 backdrop-blur md:left-56">
        <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <Link href="/app" aria-label="PostShip, accueil de l'app">
              <LogoMark className="size-7" />
            </Link>
          </div>
          <span className="hidden text-sm font-medium text-foreground md:block">Compte</span>
          <span className="justify-self-center text-sm font-medium text-foreground">{title}</span>
          <div className="flex items-center justify-self-end gap-2">
            {showChangePlan && (
              <Link href="/app/billing" className={cn(buttonVariants({ variant: "outline" }), ACTION_BUTTON_CLASS)}>
                Changer de plan
              </Link>
            )}
            <button
              type="button"
              onClick={onOpenMobile}
              aria-label="Ouvrir le menu"
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="fixed top-0 right-0 left-0 z-30 h-14 border-b bg-background/80 backdrop-blur md:left-56">
        <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <Link href="/app" aria-label="PostShip, accueil de l'app">
              <LogoMark className="size-7" />
            </Link>
          </div>
          <span className="hidden text-sm font-medium text-foreground md:block">PostShip</span>
          <span className="justify-self-center text-sm font-medium text-foreground">Projets</span>
          <button
            type="button"
            onClick={onOpenMobile}
            aria-label="Ouvrir le menu"
            className="flex size-10 items-center justify-center justify-self-end rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  const spec = getProjectBarSpec(pathname);

  return (
    <div className="fixed top-0 right-0 left-0 z-30 h-14 border-b bg-background/80 backdrop-blur md:left-56">
      {/* Desktop: 3 columns — switcher | title | actions. */}
      <div className="hidden h-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:grid">
        <ProjectSwitcher projects={projects} activeProject={activeProject} />
        <span className="justify-self-center text-sm font-medium text-foreground">{spec.title}</span>
        <div className="justify-self-end">
          <ActionSlot
            actions={spec.actions}
            project={activeProject}
            pathname={pathname}
            canWrite={canWrite}
          />
        </div>
      </div>

      {/* Mobile: one row — switcher (flex-1) + actions + menu. Merges what
          used to be AppSidebar's own logo+hamburger header, per B1 ("un
          seul bandeau mobile"). */}
      <div className="flex h-full items-center gap-2 px-3 md:hidden">
        <Link href="/app" aria-label="PostShip, accueil de l'app" className="shrink-0">
          <LogoMark className="size-7" />
        </Link>
        <div className="min-w-0 flex-1">
          <ProjectSwitcher projects={projects} activeProject={activeProject} />
          <span className="sr-only">{spec.title}</span>
        </div>
        {spec.actions.length > 0 && (
          <ActionSlot
            actions={spec.actions.slice(0, 1)}
            project={activeProject}
            pathname={pathname}
            canWrite={canWrite}
            mobile
          />
        )}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Ouvrir le menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
