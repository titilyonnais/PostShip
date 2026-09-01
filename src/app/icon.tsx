import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Same mark as src/components/logo.tsx (badge + checkmark), redrawn with
// plain divs instead of an <svg> — next/og's renderer (Satori) has already
// bitten us once on unsupported glyph rendering (see opengraph-image.tsx),
// so this sticks to the box-model-only shapes proven to work there.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e6e8eb",
          borderRadius: 7,
        }}
      >
        <div style={{ position: "relative", width: 16, height: 16, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              left: 1,
              top: 8,
              width: 7,
              height: 3,
              borderRadius: 2,
              background: "#0a0c0e",
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 5,
              top: 2,
              width: 13,
              height: 3,
              borderRadius: 2,
              background: "#0a0c0e",
              transform: "rotate(-45deg)",
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
