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
      // Displayed at most ~32px tall (h-8) anywhere in the app — without an
      // explicit sizes hint, next/image's responsive srcset assumes it could
      // fill the viewport and generates variants up to 3840px wide for what
      // ends up an ~100px-wide logo.
      sizes="120px"
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
      sizes="24px"
      className={cn("size-6", className)}
    />
  );
}
