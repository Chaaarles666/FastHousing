import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, CheckSquare, Radar } from "lucide-react";

const features = [
  {
    title: "房源对比器",
    description: "录入候选房源，按你关心的维度权重打分并可视化对比。",
    href: "/compare",
    icon: Radar,
  },
  {
    title: "交易 Checklist",
    description: "覆盖 7 个阶段的买房流程，按步骤推进，减少遗漏与踩坑。",
    href: "/checklist",
    icon: CheckSquare,
  },
  {
    title: "购房能力评估",
    description: "结合家庭收支与上海政策，快速评估可承受总价与月供压力。",
    href: "/calculator",
    icon: Calculator,
  },
];

export const metadata: Metadata = {
  title: "FastHousing | 上海买房决策工具",
  description:
    "FastHousing 提供上海购房一站式决策：房源智能对比、交易流程 Checklist、购房能力评估与税费估算，帮助买方更稳做决定。",
  keywords: ["上海买房", "房源对比", "购房能力评估", "交易流程", "税费估算", "FastHousing"],
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "FastHousing",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    inLanguage: "zh-CN",
    description:
      "站在买方立场的购房决策工具，提供房源对比、交易清单、购房能力评估。",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CNY",
    },
    areaServed: "Shanghai",
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-slate-700 p-6 text-white shadow-lg md:p-10">
        <p className="text-xs tracking-[0.2em] text-slate-200">FASTHOUSING</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">买房不踩坑，决策有底气</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-100 md:text-base">
          站在买方立场，把分散的信息整理成可执行的决策流程。先评估预算，再对比房源，最后按清单推进交易。
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-6 text-slate-200 md:text-sm">
          适合首次购房与改善型家庭：把“看房焦虑、流程复杂、预算不清”变成可量化、可追踪、可复盘的决策过程。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[var(--brand-primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600 md:p-6">
        <h3 className="text-base font-semibold text-slate-900">为什么需要 FastHousing？</h3>
        <p className="mt-3">
          看房看多了容易信息过载，交易流程又长又碎。FastHousing 把房源对比、流程管理和财务评估放在同一套工具里，
          让你每一步都知道该做什么、该防什么。
        </p>
        <ul className="mt-3 space-y-1 text-xs text-slate-500 md:text-sm">
          <li>• 对比器解决“多套房难取舍”</li>
          <li>• Checklist 解决“流程遗漏和风险盲区”</li>
          <li>• 评估器解决“预算与月供压力不清”</li>
        </ul>
      </section>
    </div>
  );
}
