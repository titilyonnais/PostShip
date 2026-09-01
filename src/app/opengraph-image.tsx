import { ImageResponse } from "next/og";

export const alt = "PostShip — surveillance post-déploiement";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0c0e",
          padding: "72px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#f85149",
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#d29922",
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#3fb950",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, color: "#e6e8eb", display: "flex" }}>
            PostShip
          </div>
          <div style={{ fontSize: 28, color: "#8b949e", display: "flex" }}>
            Vérifie votre site après chaque déploiement — Discord + email si
            ça casse.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            color: "#3fb950",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#3fb950",
              display: "flex",
            }}
          />
          <span>https://postship.fr</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
