import Image from "next/image";
import { cn } from "@/lib/utils";
import logoIcon from "../../public/logo-icon.svg";

// Icon-only mark, white on transparent — the app forces dark mode
// site-wide (see src/app/layout.tsx), so it's always placed directly
// over the dark background. No wordmark: the icon alone is the brand
// mark everywhere in the product now.
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={logoIcon}
      alt="PostShip"
      priority
      // SVGs gain nothing from Next's raster optimizer — this skips it
      // rather than flipping the images.dangerouslyAllowSVG config, which
      // is about untrusted remote SVGs, not a locally-imported, build-time
      // trusted one.
      unoptimized
      className={cn("size-8", className)}
    />
  );
}
