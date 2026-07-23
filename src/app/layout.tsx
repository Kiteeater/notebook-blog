import type { Metadata, Viewport } from "next";
import { Fraunces, Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import AppShell from "@/components/shell/AppShell";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "思考的碎片 — 个人研究观测站",
    template: "%s — 思考的碎片",
  },
  description:
    "一个关于编程、AI、系统设计与个人思考的数字研究观测站。Field notes on code, agents & systems.",
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-CN"
      className={`${fraunces.variable} ${newsreader.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
