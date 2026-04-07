import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zendesk CS Dashboard",
  description: "CS管理ダッシュボード - Zendeskチケットデータ分析",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
