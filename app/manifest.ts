import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rede de Lideranças",
    short_name: "Rede",
    description: "Contatos, lideranças e comunicados em um só lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1e9",
    theme_color: "#11182a",
    orientation: "portrait",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
