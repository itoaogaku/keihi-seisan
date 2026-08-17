import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "経費精算PDF作成",
  description: "クレジットカード明細から会社ごとの経費精算PDFを作成するツール",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "経費精算",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-secondary/40 antialiased">
        <AppHeader />
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
