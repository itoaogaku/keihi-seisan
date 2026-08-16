import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "経費精算PDF作成",
  description: "クレジットカード明細から会社ごとの経費精算PDFを作成するツール",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-secondary/40 antialiased">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
