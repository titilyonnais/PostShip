"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SortableTable, type Column } from "@/components/admin/sortable-table";
import { Tag } from "@/components/admin/console-ui";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { AdminProjectRow } from "@/lib/admin";

type FilterId = "all" | "failing" | "paused" | "stale" | "empty";

// A project whose last check is older than this isn't being watched any
// more, whatever its status says.
const STALE_HOURS = 6;

export function ProjectsTable({ projects }: { projects: AdminProjectRow[] }) {
  const [filter, setFilter] = useState<FilterId>("all");

  const buckets = useMemo(() => {
    const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000;
    return {
      all: projects,
      failing: projects.filter((p) => p.failing > 0),
      paused: projects.filter((p) => p.paused),
      stale: projects.filter(
        (p) => !p.paused && (!p.last_checked_at || new Date(p.last_checked_at).getTime() < cutoff),
      ),
      empty: projects.filter((p) => p.targets === 0),
    } satisfies Record<FilterId, AdminProjectRow[]>;
  }, [projects]);

  const columns: Column<AdminProjectRow>[] = [
    {
      key: "name",
      label: "Projet",
      sort: (p) => p.name,
      initial: "asc",
      render: (p) => (
        <>
          <Link
            href={`/admin/projects/${p.id}`}
            className="text-neutral-200 underline-offset-2 hover:underline"
          >
            {p.name}
          </Link>
          <span className="block text-[0.65rem] break-all text-neutral-600">
            {p.base_url ?? "—"}
          </span>
        </>
      ),
    },
    {
      key: "owner",
      label: "Propriétaire",
      sort: (p) => p.owner_email ?? "",
      initial: "asc",
      className: "text-neutral-400",
      render: (p) => p.owner_email ?? "—",
    },
    { key: "targets", label: "URLs", sort: (p) => p.targets, render: (p) => p.targets },
    {
      key: "failing",
      label: "En échec",
      sort: (p) => p.failing,
      render: (p) => (
        <span className={p.failing > 0 ? "text-[#f85149]" : ""}>{p.failing}</span>
      ),
    },
    {
      key: "state",
      // Ordered by how much attention it needs, not alphabetically.
      label: "État",
      sort: (p) => (p.failing > 0 ? 0 : p.paused ? 1 : 2),
      initial: "asc",
      render: (p) =>
        p.paused ? (
          <Tag tone="warn">en pause</Tag>
        ) : p.failing > 0 ? (
          <Tag tone="bad">incident</Tag>
        ) : (
          <Tag tone="good">vert</Tag>
        ),
    },
    {
      key: "checked",
      label: "Dernier check",
      sort: (p) => (p.last_checked_at ? new Date(p.last_checked_at).getTime() : 0),
      className: "text-neutral-500",
      render: (p) => (p.last_checked_at ? formatRelativeTime(p.last_checked_at) : "jamais"),
    },
    {
      key: "created",
      label: "Créé",
      sort: (p) => new Date(p.created_at).getTime(),
      className: "text-neutral-500",
      render: (p) => new Date(p.created_at).toLocaleDateString("fr-FR"),
    },
  ];

  return (
    <SortableTable
      rows={buckets[filter]}
      columns={columns}
      rowKey={(p) => p.id}
      activeFilter={filter}
      onFilter={(id) => setFilter(id as FilterId)}
      filters={[
        { id: "all", label: "tous", count: buckets.all.length },
        { id: "failing", label: "en incident", count: buckets.failing.length },
        { id: "paused", label: "en pause", count: buckets.paused.length },
        { id: "stale", label: `sans check ${STALE_HOURS} h`, count: buckets.stale.length },
        { id: "empty", label: "sans URL", count: buckets.empty.length },
      ]}
      empty="Aucun projet dans ce filtre."
    />
  );
}
