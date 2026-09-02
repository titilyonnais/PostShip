import Image from "next/image";
import { cn } from "@/lib/utils";
import logoWordmark from "../../public/logo-wordmark.svg";
import logoIcon from "../../public/logo-icon.svg";

// The full brand mark (chevron + "PostShip" wordmark), white on
// transparent — the app forces dark mode site-wide (see
// src/app/layout.tsx), so it's always placed directly over the dark
// background rather than inside a filled badge. Vector, so no responsive
// srcset/sizes concerns the way the old PNG had.
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src={logoWordmark}
      alt="PostShip"
      priority
      // SVGs gain nothing from Next's raster optimizer (resize/format
      // conversion) — this skips it rather than flipping the
      // images.dangerouslyAllowSVG config, which is about untrusted
      // remote SVGs, not a locally-imported, build-time trusted one.
      unoptimized
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
      unoptimized
      className={cn("size-6", className)}
    />
  );
}
