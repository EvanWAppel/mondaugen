import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mondaugen — weather",
    short_name: "Mondaugen",
    description:
      "A calm, ad-free personal weather app: a 10-day forecast and live radar.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b12",
    theme_color: "#0a0e13",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
