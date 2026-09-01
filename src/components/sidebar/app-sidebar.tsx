"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronDown, Menu, Plus, X } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
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
import { ACCOUNT_NAV, PROJECT_NAV, RESERVED_APP_SEGMENTS } from "./nav-config";

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

function SidebarContent({
  projects,
  profile,
  onNavigate,
}: {
  projects: Project[];
  profile: Profile;
  onNavigate?: () => void;
}) {
  const { project: activeProject, subSegment, pathname } = useActiveProject(projects);

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/app"
        onClick={onNavigate}
        className="flex shrink-0 items-center px-4 py-4"
      >
        <Logo className="h-5" />
      </Link>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {activeProject ? (
          <div className="flex flex-col gap-2">
            <ProjectSwitcher
              projects={projects}
              activeProject={activeProject}
              onNavigate={onNavigate}
            />
            <div className="flex flex-col gap-0.5">
              {PROJECT_NAV.map((item) => {
                const isActive = item.segment
                  ? subSegment === item.segment
                  : !subSegment;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href(activeProject.id)}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
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
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                Nouveau projet
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="px-2.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
            Compte
          </p>
          <div className="flex flex-col gap-0.5">
            {ACCOUNT_NAV.map((item) => {
              const isActive =
                item.href === "/app/account"
                  ? pathname === "/app/account"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted"
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
            className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-foreground/25"
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
}: {
  projects: Project[];
  profile: Profile;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-card md:flex">
        <SidebarContent projects={projects} profile={profile} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:hidden">
        <Link href="/app" className="flex items-center">
          <LogoMark className="size-6" />
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
          <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-card outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden">
            <div className="flex justify-end p-2">
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
            <div className="min-h-0 flex-1">
              <SidebarContent
                projects={projects}
                profile={profile}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
