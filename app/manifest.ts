import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NYFoodies",
    short_name: "NYFoodies",
    description:
      "Find restaurants & bars, DM them on Instagram, and track collab deals through your pipeline.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdf6ee",
    theme_color: "#f4623a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
