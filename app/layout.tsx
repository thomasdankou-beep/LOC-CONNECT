import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const siteUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Location de matériel en Côte d'Ivoire | LOC'CONNECT", template: "%s | LOC'CONNECT" },
  description: "LOC'CONNECT, la plateforme de location qui connecte clients et loueurs : tables, chapiteaux, sonorisation, outillage et plus encore, auprès de loueurs vérifiés.",
  applicationName: "LOC'CONNECT",
  openGraph: { type: "website", locale: "fr_CI", siteName: "LOC'CONNECT" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1122" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-royal focus:px-4 focus:py-2 focus:text-white">
          Aller au contenu
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
