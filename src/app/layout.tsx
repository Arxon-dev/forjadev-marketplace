import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "ForjaDev Marketplace",
  description: "Marketplace de plugins, mapas y herramientas digitales"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
