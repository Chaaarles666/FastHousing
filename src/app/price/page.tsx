"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { CommunitySummary, PriceHistoryPoint, getCommunityPriceHistory, searchCommunities } from "@/lib/api";

function formatUnitPrice(value: number) {
  return `${(value / 10000).toFixed(2)} 万/㎡`;
}

export default function PricePage() {
  const [keyword, setKeyword] = useState("");
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<CommunitySummary | null>(null);
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestPoint = useMemo(() => history[history.length - 1], [history]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const q = keyword.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setCommunities([]);
    setSelectedCommunity(null);
    setHistory([]);

    try {
      const result = await searchCommunities(q);
      setCommunities(result);
      if (result.length === 0) {
        setError("没有找到匹配小区，请换个关键词。");
      }
    } catch {
      setError("暂时无法连接后端 API，请先启动后端服务。");
    } finally {
      setLoading(false);
    }
  }

  async function chooseCommunity(community: CommunitySummary) {
    setSelectedCommunity(community);
    setError(null);
    setLoading(true);
    try {
      const points = await getCommunityPriceHistory(community.id, 12);
      setHistory(points);
    } catch {
      setHistory([]);
      setError("已选小区，但价格历史获取失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">价格透视镜</h1>
        <p className="mt-1 text-sm text-slate-600">搜索小区并查看历史价格走势、成交活跃度与挂牌概览。</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="输入小区名称，如：中远两湾城"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "搜索中..." : "搜索"}
        </button>
      </form>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {communities.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">搜索结果</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {communities.map((community) => (
              <button
                key={community.id}
                type="button"
                onClick={() => chooseCommunity(community)}
                className={`rounded-lg border p-3 text-left transition ${
                  selectedCommunity?.id === community.id
                    ? "border-[var(--brand-primary)] bg-blue-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-medium text-slate-900">{community.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {community.district ?? "未知区域"} · 在售 {community.listing_count ?? 0} 套
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedCommunity ? (
        <>
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">小区</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCommunity.name}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">区域</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCommunity.district ?? "-"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">均价</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {selectedCommunity.avg_unit_price ? formatUnitPrice(selectedCommunity.avg_unit_price) : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">在售</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCommunity.listing_count ?? 0} 套</p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">近12个月价格走势</h2>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg_unit_price" stroke="#1e3a5f" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">成交活跃度</h2>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="deal_count" fill="#ff6b35" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <h2 className="font-semibold text-slate-900">挂牌价 vs 成交价差距分析</h2>
            <p className="mt-2">
              当前版本已接入价格历史趋势与成交活跃度。待后端 `transactions/stats` 完整上线后，这里会展示挂牌-成交差价、成交周期和统计结论。
            </p>
            {latestPoint ? (
              <p className="mt-2 text-xs text-slate-500">
                最新快照：{latestPoint.date} · 均价{" "}
                {latestPoint.avg_unit_price ? formatUnitPrice(latestPoint.avg_unit_price) : "-"} · 成交{" "}
                {latestPoint.deal_count ?? 0} 套
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
