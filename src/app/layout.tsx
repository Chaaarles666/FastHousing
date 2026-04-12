import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export const metadata: Metadata = {
  title: "FastHousing - 买房不踩坑，决策有底气",
  description: "上海购房决策工具：房源智能对比、交易全流程避坑指南、家庭购房能力评估",
  metadataBase: new URL("http://localhost:3000"),
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "FastHousing - 买房不踩坑，决策有底气",
    description: "上海购房决策工具：房源智能对比、交易全流程避坑指南、家庭购房能力评估",
    type: "website",
    locale: "zh_CN",
    url: "/",
    images: ["/og-image.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FastHousing - 买房不踩坑，决策有底气",
    description: "上海购房决策工具：房源智能对比、交易全流程避坑指南、家庭购房能力评估",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <div className="flex min-h-screen flex-col pb-16 md:pb-0">
          <Header />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 md:px-6 md:py-10">
            {children}
          </main>
          <Footer />
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
