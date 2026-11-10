import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin/",
    name: "CALA · Casa Caballo Soñador",
    short_name: "CALA",
    lang: "es-MX",
    description: "Administración de Casa Caballo Soñador",
    start_url: "/admin/inicio/",
    scope: "/admin/",
    display: "standalone",
    background_color: "#f5f2ea",
    theme_color: "#f5f2ea",
    icons: [
      { src: "/cala/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/cala/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/cala/pwa/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
