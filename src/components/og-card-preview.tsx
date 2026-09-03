"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

export type OgCardPreviewProps = {
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
};

// 1.91:1 mirrors the aspect ratio social platforms crop og:image to, so
// what's shown here matches what actually renders when the link is shared.
export function OgCardPreview({ title, description, image, domain }: OgCardPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  // The check itself already validated this URL server-side (SSRF guard,
  // reachability HEAD) — https-only here is just a display-time sanity
  // check, not the security boundary. No open proxy: rendered directly as
  // <img src>, never fetched/re-served by our own backend.
  const showImage = !!image && image.startsWith("https://") && !imageFailed;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="aspect-[1.91/1] w-full bg-secondary">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff className="size-5" aria-hidden="true" />
            <span className="text-xs">Pas d&apos;image valide</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <p className="truncate text-xs text-muted-foreground">{domain}</p>
        <p className="truncate text-sm font-medium">{title || "Sans titre"}</p>
        {description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
