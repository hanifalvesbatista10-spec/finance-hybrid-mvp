import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Equity One | Gestão Financeira Inteligente",
  description: "Gestão financeira pessoal, empresarial e especializada em um único ecossistema.",
  applicationName: "Equity One",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Equity One",
    statusBarStyle: "black-translucent",
  },
  other: {
    "facebook-domain-verification": "lgxmbuuq3yaqylp2htgtw1rkrwaj0t",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
