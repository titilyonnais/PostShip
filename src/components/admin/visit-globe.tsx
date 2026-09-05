"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// An orthographic globe in plain SVG. No charting or geo library at
// runtime: the projection is six lines of trigonometry, and every library
// that draws one arrives with its own palette and its own idea of a
// tooltip, both of which would then have to be fought back into this
// console's language.
//
// The coastlines are Natural Earth 110m (public domain, via world-atlas),
// decoded from TopoJSON to plain coordinate rings once at author time and
// served as /brand/land-110m.json — so the browser ships no topology
// decoder either. 75 kB, fetched only on this page.

export type GlobePoint = {
  lat: number;
  lon: number;
  hits: number;
  label: string;
};

type Rotation = { lambda: number; phi: number };
type Ring = [number, number][];

const R = 150;
const SIZE = 340;
const CX = SIZE / 2;
const CY = SIZE / 2;

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Standard orthographic projection: rotate the sphere, then drop the z
// axis. `visible` is the far-side test — without it the back of the globe
// draws over the front.
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

// Breaks a ring wherever it crosses the horizon, so a continent half on
// the far side draws as the arc that is actually facing us rather than as
// a line cutting across the globe.
function ringPath(ring: Ring, rotation: Rotation): string {
  let path = "";
  let pen = false;

  for (const [lon, lat] of ring) {
    const p = project(lat, lon, rotation);
    if (!p.visible) {
      pen = false;
      continue;
    }
    path += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }

  return path;
}

function graticule(rotation: Rotation): string[] {
  const paths: string[] = [];

  for (let lat = -60; lat <= 60; lat += 30) {
    const ring: Ring = [];
    for (let lon = -180; lon <= 180; lon += 4) ring.push([lon, lat]);
    const path = ringPath(ring, rotation);
    if (path) paths.push(path);
  }

  for (let lon = -180; lon < 180; lon += 30) {
    const ring: Ring = [];
    for (let lat = -90; lat <= 90; lat += 4) ring.push([lon, lat]);
    const path = ringPath(ring, rotation);
    if (path) paths.push(path);
  }

  return paths;
}

export function VisitGlobe({ points }: { points: GlobePoint[] }) {
  const [rotation, setRotation] = useState<Rotation>({ lambda: 0, phi: -15 });
  const [spinning, setSpinning] = useState(true);
  const [hover, setHover] = useState<GlobePoint | null>(null);
  const [land, setLand] = useState<Ring[]>([]);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deliberately not blocking the render: the globe draws its graticule
    // and its points immediately, and the coastlines fade in.
    fetch("/brand/land-110m.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((rings: Ring[]) => {
        if (!cancelled) setLand(rings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!spinning) return;
    const timer = setInterval(
      () => setRotation((r) => ({ ...r, lambda: (r.lambda + 0.4) % 360 })),
      50,
    );
    return () => clearInterval(timer);
  }, [spinning]);

  const landPaths = useMemo(
    () => land.map((ring) => ringPath(ring, rotation)).filter(Boolean),
    [land, rotation],
  );

  const maxHits = Math.max(1, ...points.map((p) => p.hits));

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto w-full max-w-[340px] cursor-grab touch-none select-none active:cursor-grabbing"
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
            // Plus, not minus: increasing phi pushes the front of the
            // globe down the screen, so dragging up has to increase it
            // for the surface to follow the cursor. It was inverted.
            // Clamped, because past the poles the projection turns
            // inside out.
            phi: Math.max(-85, Math.min(85, r.phi + dy * 0.4)),
          }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <circle cx={CX} cy={CY} r={R} fill="#0b0d10" stroke="#1f2428" strokeWidth="1" />

        {graticule(rotation).map((d, i) => (
          <path key={`grat-${i}`} d={d} fill="none" stroke="#161b20" strokeWidth="0.75" />
        ))}

        {landPaths.map((d, i) => (
          <path
            key={`land-${i}`}
            d={d}
            fill="#1c2329"
            stroke="#2b343b"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
        ))}

        {points.map((point, i) => {
          const p = project(point.lat, point.lon, rotation);
          if (!p.visible) return null;
          // Area, not radius, tracks the count — a radius scale makes a
          // ten-fold difference look like a hundred-fold one.
          const radius = 2.5 + 7 * Math.sqrt(point.hits / maxHits);
          return (
            <g key={`${point.label}-${i}`}>
              <circle cx={p.x} cy={p.y} r={radius + 4} fill="#3fb950" opacity={0.15} />
              <circle
                cx={p.x}
                cy={p.y}
                r={radius}
                fill="#3fb950"
                opacity={0.9}
                onPointerEnter={() => setHover(point)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-between gap-3 font-mono text-[0.65rem] text-neutral-600">
        <span>
          {hover ? `${hover.label} — ${hover.hits} visites` : "Glissez pour tourner"}
        </span>
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
