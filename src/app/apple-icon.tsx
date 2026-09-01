import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as src/app/icon.tsx, scaled up for the iOS home-screen icon.
export default function AppleIcon() {
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
          borderRadius: 39,
        }}
      >
        <div style={{ position: "relative", width: 90, height: 90, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 45,
              width: 39,
              height: 17,
              borderRadius: 10,
              background: "#0a0c0e",
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 11,
              width: 73,
              height: 17,
              borderRadius: 10,
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
