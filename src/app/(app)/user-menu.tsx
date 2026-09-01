"use client";

import Link from "next/link";
import { ChevronDown, CreditCard, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "./actions";

export function UserMenu({
  displayName,
  email,
  avatarUrl,
}: {
  displayName: string;
  email: string;
  avatarUrl: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 pl-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- external DiceBear SVG, not a local/optimizable asset */}
            <img
              src={avatarUrl}
              alt=""
              className="size-5 rounded-full bg-secondary"
              width={20}
              height={20}
            />
            <span className="max-w-32 truncate text-xs">{displayName}</span>
            <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <div className="px-1.5 py-1 text-xs text-muted-foreground">{email}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app/account" />}>
          <Settings className="size-3.5" aria-hidden="true" />
          Paramètres
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app/billing" />}>
          <CreditCard className="size-3.5" aria-hidden="true" />
          Abonnement
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem
            variant="destructive"
            nativeButton
            render={<button type="submit" className="w-full" />}
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Déconnexion
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
