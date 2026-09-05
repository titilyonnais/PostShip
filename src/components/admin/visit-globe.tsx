"use client";

import { useEffect, useRef, useState } from "react";

// An orthographic globe in plain SVG. No charting or geo library: the
// projection is six lines of trigonometry, and every library that draws
// one arrives with its own palette and its own idea of a tooltip, both of
// which would then have to be fought back into this console's language.
//
// What it deliberately does not have is coastlines. Those need a
// geometry file — Natural Earth or equivalent — and shipping one for a
// page whose question is "where are my visitors clustered" would be
// weight for decoration. The graticule gives the sphere its orientation;
// the labels name the places.

export type GlobePoint = {
  lat: number;
  lon: number;
  hits: number;
  label: string;
};

type Rotation = { lambda: number; phi: number };

const R = 150;
const SIZE = 340;
const CX = SIZE / 2;
const CY = SIZE / 2;

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Standard orthographic projection: rotate the sphere, then drop the
// z axis. `visible` is the far-side test — without it the back of the
// globe draws over the front.
function project(lat: number, lon: number, rotation: Rotation) {
  const phi = toRad(lat);
  const lambda = toRad(lon) + toRad(rotation.lambda);
  const rotPhi = toRad(rotation.phi);

  const cosPhi = Math.cos(phi);
  const x = cosPhi * Math.sin(lambda);
  const y = Math.sin(phi);
  const z = cosPhi * Math.cos(lambda);

  const yr = y * Math.cos(rotPhi) - z * Math.sin(rotPhi);
  const zr = y * Math.sin(rotPhi) + z * Math.cos(rotPhi);

  return { x: CX + R * x, y: CY - R * yr, visible: zr > 0 };
}

function graticule(rotation: Rotation): string[] {
  const paths: string[] = [];

  // Parallels every 30°, meridians every 30°. Enough to read the
  // orientation, sparse enough not to become a net.
  for (let lat = -60; lat <= 60; lat += 30) {
    let path = "";
    let pen = false;
    for (let lon = -180; lon <= 180; lon += 4) {
      const p = project(lat, lon, rotation);
      if (!p.visible) {
        pen = false;
        continue;
      }
      path += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      pen = true;
    }
    if (path) paths.push(path);
  }

  for (let lon = -180; lon < 180; lon += 30) {
    let path = "";
    let pen = false;
    for (let lat = -90; lat <= 90; lat += 4) {
      const p = project(lat, lon, rotation);
      if (!p.visible) {
        pen = false;
        continue;
      }
      path += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      pen = true;
    }
    if (path) paths.push(path);
  }

  return paths;
}

export function VisitGlobe({ points }: { points: GlobePoint[] }) {
  const [rotation, setRotation] = useState<Rotation>({ lambda: 0, phi: -15 });
  const [spinning, setSpinning] = useState(true);
  const [hover, setHover] = useState<GlobePoint | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!spinning) return;
    const timer = setInterval(
      () => setRotation((r) => ({ ...r, lambda: (r.lambda + 0.4) % 360 })),
      50,
    );
    return () => clearInterval(timer);
  }, [spinning]);

  const maxHits = Math.max(1, ...points.map((p) => p.hits));

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto w-full max-w-[340px] cursor-grab touch-none active:cursor-grabbing"
        role="img"
        aria-label={`Globe des visites — ${points.length} lieux`}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY };
          setSpinning(false);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
          setRotation((r) => ({
            lambda: (r.lambda + dx * 0.4) % 360,
            // Clamped: past the poles the projection turns inside out.
            phi: Math.max(-85, Math.min(85, r.phi - dy * 0.4)),
          }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <circle cx={CX} cy={CY} r={R} fill="#0b0d10" stroke="#1f2428" strokeWidth="1" />

        {graticule(rotation).map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#1a1f24" strokeWidth="0.75" />
        ))}

        {points.map((point, i) => {
          const p = project(point.lat, point.lon, rotation);
          if (!p.visible) return null;
          // Area, not radius, tracks the count — a radius scale makes a
          // ten-fold difference look like a hundred-fold one.
          const radius = 2.5 + 7 * Math.sqrt(point.hits / maxHits);
          return (
            <g key={`${point.label}-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={radius + 4}
                fill="#3fb950"
                opacity={0.12}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={radius}
                fill="#3fb950"
                opacity={0.85}
                onPointerEnter={() => setHover(point)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-between gap-3 font-mono text-[0.65rem] text-neutral-600">
        <span>{hover ? `${hover.label} — ${hover.hits} visites` : "Glissez pour tourner"}</span>
        <button
          type="button"
          onClick={() => setSpinning((s) => !s)}
          className="border border-neutral-800 px-2 py-0.5 hover:border-neutral-600 hover:text-neutral-300"
        >
          {spinning ? "arrêter" : "tourner"}
        </button>
      </div>
    </div>
  );
}
