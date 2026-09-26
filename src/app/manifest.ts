import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "atmosphere — weather",
    short_name: "atmosphere",
    description:
      "A calm, ad-free personal weather app: a 10-day forecast and live radar.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b12",
    theme_color: "#0a0e13",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
