"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { statusDotClass } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(app)/actions";
import {
  ACCOUNT_DANGER_ITEM,
  ACCOUNT_DRILL_CATEGORY,
  ACCOUNT_NAV_GROUPS,
  PROJECT_NAV_GROUPS,
  RESERVED_APP_SEGMENTS,
  groupIdForProjectSegment,
  type AccountNavItem,
  type NavItem,
} from "./nav-config";

type Project = {
  id: string;
  name: string;
  base_url: string;
  last_status: string | null;
};

type Profile = {
  displayName: string;
  email: string;
  avatarUrl: string;
};

function isAccountPathname(pathname: string): boolean {
  return (
    pathname === "/app/account" ||
    pathname.startsWith("/app/account/") ||
    pathname === "/app/billing" ||
    pathname.startsWith("/app/billing/")
  );
}

function useActiveProject(projects: Project[]) {
  const pathname = usePathname();
  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    // segments[0] === "app"
    const candidate = segments[1];
    if (!candidate || RESERVED_APP_SEGMENTS.has(candidate)) {
      return { project: null, subSegment: undefined as string | undefined, pathname };
    }
    const project = projects.find((p) => p.id === candidate) ?? null;
    return { project, subSegment: segments[2], pathname };
  }, [pathname, projects]);
}

// D1-D4 (drill-nav backlog): two exclusive levels, pathname is the source
// of truth for which one shows — `forcedRoot` only exists to let "←"
// show level 0 without navigating (pathname unchanged). Any real
// navigation clears it, so a refresh always lands on the level the URL
// actually implies.
function useDrillNav(activeProject: Project | null, subSegment: string | undefined, pathname: string) {
  const accountMode = isAccountPathname(pathname);

  const contentPane = useMemo(() => {
    if (accountMode) return "compte";
    if (activeProject) return groupIdForProjectSegment(subSegment);
    return null;
  }, [accountMode, activeProject, subSegment]);

  const [forcedRoot, setForcedRoot] = useState(false);
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      setForcedRoot(false);
    }
  }, [pathname]);

  const visiblePane = forcedRoot ? null : contentPane;
  const goBack = useCallback(() => setForcedRoot(true), []);

  useEffect(() => {
    if (!visiblePane) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") goBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visiblePane, goBack]);

  return { contentPane, visiblePane, accountMode, goBack };
}

function NavLink({
  href,
  label,
  Icon,
  isActive,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  isActive: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!badge && (
        <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[0.65rem] font-medium leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

function CategoryRow({
  href,
  label,
  Icon,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!badge && (
        <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[0.65rem] font-medium leading-none text-white">
          {badge}
        </span>
      )}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
    </Link>
  );
}

function DrillBackHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1 px-2.5 py-1 text-[0.65rem] font-medium tracking-wide text-muted-foreground/70 uppercase transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function NavGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
      {children}
    </p>
  );
}

function SidebarContent({
  projects,
  profile,
  openIncidentCounts,
  onNavigate,
}: {
  projects: Project[];
  profile: Profile;
  openIncidentCounts: Record<string, number>;
  onNavigate?: () => void;
}) {
  const { project: activeProject, subSegment, pathname } = useActiveProject(projects);
  const { contentPane, visiblePane, accountMode, goBack } = useDrillNav(
    activeProject,
    subSegment,
    pathname,
  );

  // Kept across a visit to /app/account/* so the level-0 categories still
  // anchor to the project you came from — an ordinary in-memory piece of
  // context, not the pane's source of truth (that stays pathname/forcedRoot).
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  useEffect(() => {
    if (activeProject) setLastProjectId(activeProject.id);
  }, [activeProject]);

  const anchorProject =
    activeProject ??
    (accountMode ? (projects.find((p) => p.id === lastProjectId) ?? null) : null);

  const activeGroup =
    contentPane && contentPane !== "compte"
      ? PROJECT_NAV_GROUPS.find((g) => g.id === contentPane)
      : null;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <Link
        href="/app"
        onClick={onNavigate}
        className="flex shrink-0 items-center px-4 py-4"
      >
        <LogoMark className="size-8" />
      </Link>

      <nav className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-4">
        <div className="relative w-full overflow-hidden">
          <div
            className="flex w-[200%] transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:duration-0"
            style={{ transform: visiblePane ? "translateX(-50%)" : "translateX(0%)" }}
          >
            {/* Level 0 */}
            <div className="flex w-1/2 min-w-0 shrink-0 flex-col gap-2 px-3">
              {anchorProject ? (
                <>
                  <ProjectSwitcher
                    projects={projects}
                    activeProject={anchorProject}
                    onNavigate={onNavigate}
                  />
                  <div className="flex flex-col gap-0.5">
                    {PROJECT_NAV_GROUPS.map((group) => (
                      <CategoryRow
                        key={group.id}
                        href={group.items[0]!.href(anchorProject.id)}
                        label={group.label}
                        Icon={group.icon}
                        badge={
                          group.id === "surveillance"
                            ? (openIncidentCounts[anchorProject.id] ?? 0)
                            : 0
                        }
                        onNavigate={onNavigate}
                      />
                    ))}
                    <CategoryRow
                      href={ACCOUNT_DRILL_CATEGORY.href}
                      label={ACCOUNT_DRILL_CATEGORY.label}
                      Icon={ACCOUNT_DRILL_CATEGORY.icon}
                      onNavigate={onNavigate}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="px-2.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
                    Projets
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {projects.map((p) => (
                      <Link
                        key={p.id}
                        href={`/app/${p.id}`}
                        onClick={onNavigate}
                        className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            statusDotClass(p.last_status),
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    ))}
                    {projects.length === 0 && (
                      <p className="px-2.5 text-xs text-muted-foreground">
                        Aucun projet pour le moment.
                      </p>
                    )}
                    <Link
                      href="/app"
                      onClick={onNavigate}
                      className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">Nouveau projet</span>
                    </Link>
                    <CategoryRow
                      href={ACCOUNT_DRILL_CATEGORY.href}
                      label={ACCOUNT_DRILL_CATEGORY.label}
                      Icon={ACCOUNT_DRILL_CATEGORY.icon}
                      onNavigate={onNavigate}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Level 1 */}
            <div className="flex w-1/2 min-w-0 shrink-0 flex-col gap-4 px-3">
              {contentPane === "compte" ? (
                <>
                  <DrillBackHeader label="Compte" onBack={goBack} />
                  {ACCOUNT_NAV_GROUPS.map((group) => (
                    <div key={group.label} className="flex flex-col gap-1">
                      <NavGroupLabel>{group.label}</NavGroupLabel>
                      <div className="flex flex-col gap-0.5">
                        {group.items.map((item: AccountNavItem) => (
                          <NavLink
                            key={item.href}
                            href={item.href}
                            label={item.label}
                            Icon={item.icon}
                            isActive={
                              item.href === "/app/account"
                                ? pathname === "/app/account"
                                : pathname === item.href ||
                                  pathname.startsWith(`${item.href}/`)
                            }
                            onNavigate={onNavigate}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  <NavLink
                    href={ACCOUNT_DANGER_ITEM.href}
                    label={ACCOUNT_DANGER_ITEM.label}
                    Icon={ACCOUNT_DANGER_ITEM.icon}
                    isActive={pathname === ACCOUNT_DANGER_ITEM.href}
                    onNavigate={onNavigate}
                  />
                </>
              ) : activeGroup && anchorProject ? (
                <>
                  <DrillBackHeader label={activeGroup.label} onBack={goBack} />
                  <div className="flex flex-col gap-0.5">
                    {activeGroup.items.map((item: NavItem) => {
                      const isActive = item.segment
                        ? subSegment === item.segment
                        : !subSegment;
                      const incidentCount =
                        item.segment === "incidents"
                          ? (openIncidentCounts[anchorProject.id] ?? 0)
                          : 0;
                      return (
                        <NavLink
                          key={item.label}
                          href={item.href(anchorProject.id)}
                          label={item.label}
                          Icon={item.icon}
                          isActive={isActive}
                          badge={incidentCount}
                          onNavigate={onNavigate}
                        />
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      <div className="min-w-0 shrink-0 border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted"
              />
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- external DiceBear SVG */}
            <img
              src={profile.avatarUrl}
              alt=""
              className="size-6 shrink-0 rounded-full bg-secondary"
              width={24}
              height={24}
            />
            <span className="min-w-0 flex-1 truncate text-xs">
              {profile.displayName}
            </span>
            <ChevronDown
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <div className="truncate px-1.5 py-1 text-xs text-muted-foreground">
              {profile.email}
            </div>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem
                variant="destructive"
                nativeButton
                render={<button type="submit" className="w-full" />}
              >
                Déconnexion
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ProjectSwitcher({
  projects,
  activeProject,
  onNavigate,
}: {
  projects: Project[];
  activeProject: Project;
  onNavigate?: () => void;
}) {
  const others = projects.filter((p) => p.id !== activeProject.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-foreground/25"
          />
        }
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            statusDotClass(activeProject.last_status),
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {activeProject.name}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-56">
        {others.length > 0 && (
          <>
            {others.map((p) => (
              <DropdownMenuItem
                key={p.id}
                render={<Link href={`/app/${p.id}`} onClick={onNavigate} />}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    statusDotClass(p.last_status),
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem render={<Link href="/app" onClick={onNavigate} />}>
          Tous les projets
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app" onClick={onNavigate} />}>
          <Plus className="size-3.5" aria-hidden="true" />
          Nouveau projet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar({
  projects,
  profile,
  openIncidentCounts = {},
}: {
  projects: Project[];
  profile: Profile;
  openIncidentCounts?: Record<string, number>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 overflow-hidden border-r border-border bg-card md:flex">
        <SidebarContent
          projects={projects}
          profile={profile}
          openIncidentCounts={openIncidentCounts}
        />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:hidden">
        <Link href="/app" className="flex items-center">
          <LogoMark className="size-7" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden" />
          <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col overflow-hidden bg-card outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden">
            <div className="flex shrink-0 justify-end p-2">
              <DialogPrimitive.Close
                render={
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Fermer le menu"
                  />
                }
              >
                <X className="size-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 min-w-0 flex-1">
              <SidebarContent
                projects={projects}
                profile={profile}
                openIncidentCounts={openIncidentCounts}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
