  import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./navigation.css";
import "./plans.css";
import "./team.css";

export const metadata: Metadata = {
  title: "Growr360 — Gestión agrícola inteligente",
  description: "Mapa, lotes, monitoreos, imágenes satelitales y gestión productiva en una sola plataforma.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.png"
  },
  other: { "growr-release": "21" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
