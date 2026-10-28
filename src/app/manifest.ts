import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CEO For A Day",
    short_name: "CEO For A Day",
    description: "Sit in the hot seat of real companies. Make the calls, live with the results, learn what really happened.",
    start_url: "/app",
    display: "standalone",
    background_color: "#0b1015",
    theme_color: "#0b1015",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
