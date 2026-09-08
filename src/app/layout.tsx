import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "片场 · AIGC 内容创作与交付平台",
  description: "标准化 Brief、可信创作者、可验收交付与权利链记录。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
