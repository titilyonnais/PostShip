"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronDown, Menu, Plus, X, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { statusDotClass, statusLabel } from "@/lib/status";
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
  ACCOUNT_MENU_ITEMS,
  PROJECT_NAV_BOTTOM,
  PROJECT_NAV_OBSERVABILITE,
  PROJECT_NAV_TOP,
  RESERVED_APP_SEGMENTS,
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
        "flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
  const { project: activeProject, subSegment } = useActiveProject(projects);

  function isItemActive(item: NavItem) {
    return item.segment ? subSegment === item.segment : !subSegment;
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <Link
        href="/app"
        onClick={onNavigate}
        className="flex shrink-0 items-center px-4 py-4"
      >
        <LogoMark className="size-8" />
      </Link>

      <nav className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {activeProject ? (
          <div className="flex flex-col gap-4">
            <ProjectSwitcher
              projects={projects}
              activeProject={activeProject}
              onNavigate={onNavigate}
            />

            <div className="flex flex-col gap-0.5">
              {PROJECT_NAV_TOP.map((item) => (
                <NavLink
                  key={item.label}
                  href={item.href(activeProject.id)}
                  label={item.label}
                  Icon={item.icon}
                  isActive={isItemActive(item)}
                  badge={
                    item.segment === "incidents"
                      ? (openIncidentCounts[activeProject.id] ?? 0)
                      : 0
                  }
                  onNavigate={onNavigate}
                />
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <NavGroupLabel>{PROJECT_NAV_OBSERVABILITE.label}</NavGroupLabel>
              <div className="flex flex-col gap-0.5">
                {PROJECT_NAV_OBSERVABILITE.items.map((item) => (
                  <NavLink
                    key={item.label}
                    href={item.href(activeProject.id)}
                    label={item.label}
                    Icon={item.icon}
                    isActive={isItemActive(item)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-0.5 border-t border-border pt-3">
              {PROJECT_NAV_BOTTOM.map((item) => (
                <NavLink
                  key={item.label}
                  href={item.href(activeProject.id)}
                  label={item.label}
                  Icon={item.icon}
                  isActive={isItemActive(item)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
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
                  className="flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      statusDotClass(p.last_status),
                    )}
                    aria-hidden="true"
                  />
                  <span className="sr-only">{statusLabel(p.last_status)}</span>
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
                className="flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Nouveau projet</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="min-w-0 shrink-0 border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full min-w-0 items-center gap-2 rounded-full px-1.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            {ACCOUNT_MENU_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.href}
                render={<Link href={item.href} onClick={onNavigate} />}
              >
                <item.icon className="size-3.5" aria-hidden="true" />
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              variant="destructive"
              render={<Link href={ACCOUNT_DANGER_ITEM.href} onClick={onNavigate} />}
            >
              <ACCOUNT_DANGER_ITEM.icon className="size-3.5" aria-hidden="true" />
              {ACCOUNT_DANGER_ITEM.label}
            </DropdownMenuItem>
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
            aria-label="Projet actif, changer de projet"
            className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <span className="sr-only">{statusLabel(activeProject.last_status)}</span>
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
                <span className="sr-only">{statusLabel(p.last_status)}</span>
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 overflow-hidden border-r border-border bg-card md:flex">
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
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
