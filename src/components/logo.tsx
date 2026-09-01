import Image from "next/image";
import { cn } from "@/lib/utils";
import logoWordmark from "../../public/logo-wordmark.png";
import logoIcon from "../../public/logo-icon.png";

// The full brand mark (chevron + dot, "PostShip" wordmark). Drawn on a
// transparent background — the app forces dark mode site-wide (see
// src/app/layout.tsx), so it's always placed directly over the dark
// background rather than inside a filled badge.
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src={logoWordmark}
      alt="PostShip"
      priority
      className={cn("h-6 w-auto", className)}
    />
  );
}

// Icon-only mark (no wordmark) — compact contexts like the mobile top bar.
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={logoIcon}
      alt="PostShip"
      priority
      className={cn("size-6", className)}
    />
  );
}
