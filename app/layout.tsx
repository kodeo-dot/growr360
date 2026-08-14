  import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growr360 — Gestión agrícola inteligente",
  description: "Mapa, lotes, monitoreos, imágenes satelitales y gestión productiva en una sola plataforma.",
  other: { "growr-release": "20" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
