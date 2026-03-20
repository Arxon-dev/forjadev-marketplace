import "./globals.css";
import { ReactNode } from "react";
import { SiteFooterServer } from "@/components/layout/site-footer-server";

export const metadata = {
  title: "ForjaDev Marketplace",
  description: "Marketplace de plugins, mapas y herramientas digitales"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <SiteFooterServer />
      </body>
    </html>
  );
}
