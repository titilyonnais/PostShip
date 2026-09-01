"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Low-friction way back after following a link from a project page into
// Compte/Abonnement (e.g. "en acheter" from the scan panel, or a plan-gated
// upgrade link) — those links append ?from=/app/<projectId>.
export function BackToProjectLink() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  if (!from || !from.startsWith("/app/") || from.startsWith("//")) return null;

  return (
    <Link
      href={from}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3" aria-hidden="true" />
      Retour au projet
    </Link>
  );
}
