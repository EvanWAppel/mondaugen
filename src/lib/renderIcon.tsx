import { ImageResponse } from "next/og";

/**
 * Render the app icon as a PNG at the given size (for the PWA manifest / install
 * criteria). Kept to plain divs so it renders reliably under Satori (next/og):
 * a warm sun disc on the dark app background.
 */
export function renderIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#0c1524",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: `${size * 0.52}px`,
            height: `${size * 0.52}px`,
            borderRadius: "50%",
            background: "#ffb454",
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
