"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SortableTable, type Column } from "@/components/admin/sortable-table";
import { Tag } from "@/components/admin/console-ui";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { AdminUserRow } from "@/lib/admin";

// Plans are ordered by what they are worth, not alphabetically: sorting
// by plan is a question about revenue, and free/solo/team happens to sort
// f-s-t, which is neither.
const PLAN_RANK: Record<string, number> = { free: 0, solo: 1, team: 2 };

// Same for subscription status: the ones needing attention sort to one
// end rather than scattering by first letter.
const STATUS_RANK: Record<string, number> = {
  past_due: 0,
  unpaid: 1,
  incomplete: 2,
  trialing: 3,
  active: 4,
  canceled: 5,
};

type FilterId = "all" | "risk" | "paying" | "past_due" | "inactive";

const INACTIVE_DAYS = 30;

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [filter, setFilter] = useState<FilterId>("all");

  const buckets = useMemo(() => {
    const now = Date.now();
    const inactive = (u: AdminUserRow) =>
      !u.last_seen_at ||
      now - new Date(u.last_seen_at).getTime() > INACTIVE_DAYS * 24 * 60 * 60 * 1000;

    return {
      all: users,
      risk: users.filter((u) => (u.riskScore ?? 0) > 0),
      paying: users.filter((u) => u.plan && u.plan !== "free"),
      past_due: users.filter(
        (u) =>
          u.stripe_subscription_status === "past_due" ||
          u.stripe_subscription_status === "unpaid",
      ),
      inactive: users.filter(inactive),
    } satisfies Record<FilterId, AdminUserRow[]>;
  }, [users]);

  const columns: Column<AdminUserRow>[] = [
    {
      key: "email",
      label: "Compte",
      sort: (u) => u.email ?? u.id,
      initial: "asc",
      render: (u) => (
        <>
          <Link
            href={`/admin/users/${u.id}`}
            className="text-neutral-200 underline-offset-2 hover:underline"
          >
            {u.email ?? u.id}
          </Link>
          {u.username && (
            <span className="block text-[0.65rem] text-neutral-600">@{u.username}</span>
          )}
        </>
      ),
    },
    {
      key: "risk",
      label: "Risque",
      sort: (u) => u.riskScore ?? 0,
      render: (u) => {
        const score = u.riskScore ?? 0;
        return score >= 40 ? (
          <Tag tone="bad">{score}</Tag>
        ) : score > 0 ? (
          <Tag tone="warn">{score}</Tag>
        ) : (
          <span className="text-neutral-700">—</span>
        );
      },
    },
    {
      key: "plan",
      label: "Plan",
      sort: (u) => PLAN_RANK[u.plan ?? "free"] ?? 0,
      render: (u) => (
        <Tag tone={u.plan === "free" || !u.plan ? "neutral" : "good"}>{u.plan ?? "free"}</Tag>
      ),
    },
    {
      key: "subscription",
      label: "Abonnement",
      sort: (u) => STATUS_RANK[u.stripe_subscription_status ?? ""] ?? 9,
      initial: "asc",
      render: (u) =>
        u.stripe_subscription_status ? (
          <Tag
            tone={
              u.stripe_subscription_status === "active"
                ? "good"
                : u.stripe_subscription_status === "past_due" ||
                    u.stripe_subscription_status === "unpaid"
                  ? "bad"
                  : "warn"
            }
          >
            {u.stripe_subscription_status}
          </Tag>
        ) : (
          <span className="text-neutral-700">—</span>
        ),
    },
    { key: "projects", label: "Projets", sort: (u) => u.projects, render: (u) => u.projects },
    { key: "targets", label: "URLs", sort: (u) => u.targets, render: (u) => u.targets },
    {
      key: "tokens",
      label: "Tokens",
      sort: (u) => u.token_balance ?? 0,
      render: (u) => u.token_balance ?? 0,
    },
    {
      key: "seen",
      label: "Vu",
      // Never-seen sorts as the oldest possible, so "least recently
      // active" puts them where you would look for them.
      sort: (u) => (u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0),
      className: "text-neutral-500",
      render: (u) => (u.last_seen_at ? formatRelativeTime(u.last_seen_at) : "jamais"),
    },
    {
      key: "created",
      label: "Inscrit",
      sort: (u) => new Date(u.created_at).getTime(),
      className: "text-neutral-500",
      render: (u) => new Date(u.created_at).toLocaleDateString("fr-FR"),
    },
  ];

  return (
    <SortableTable
      rows={buckets[filter]}
      columns={columns}
      rowKey={(u) => u.id}
      activeFilter={filter}
      onFilter={(id) => setFilter(id as FilterId)}
      filters={[
        { id: "all", label: "tous", count: buckets.all.length },
        { id: "risk", label: "à risque", count: buckets.risk.length },
        { id: "paying", label: "payants", count: buckets.paying.length },
        { id: "past_due", label: "impayés", count: buckets.past_due.length },
        { id: "inactive", label: `inactifs ${INACTIVE_DAYS} j`, count: buckets.inactive.length },
      ]}
      empty="Aucun compte dans ce filtre."
    />
  );
}
