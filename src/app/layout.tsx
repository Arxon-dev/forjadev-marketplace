import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { SiteFooterServer } from "@/components/layout/site-footer-server";
import { getMarketplaceMetadataBase } from "@/lib/seo/public-metadata";

export const metadata: Metadata = {
  metadataBase: getMarketplaceMetadataBase(),
  title: {
    default: "ForjaDev Marketplace",
    template: "%s | ForjaDev Marketplace",
  },
  description: "Marketplace de plugins, mapas y herramientas digitales",
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
