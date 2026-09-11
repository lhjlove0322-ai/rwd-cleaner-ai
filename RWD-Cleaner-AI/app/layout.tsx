import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RWD Cleaner AI",
  description: "모바일 헬스케어 RWD 품질 점검 및 전처리 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
