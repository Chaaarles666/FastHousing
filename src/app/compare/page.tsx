"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { DEFAULT_DIMENSIONS, STORAGE_KEYS } from "@/lib/constants";
import { getExportErrorMessage } from "@/lib/export";
import { HouseItem, ScoreDimension } from "@/lib/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { StarRating } from "@/components/compare/star-rating";
import { CommunitySummary, ListingItem, getListings, searchCommunities } from "@/lib/api";

type TemplateId = "school" | "commute" | "value" | "family";

interface HouseFormState {
  name: string;
  totalPrice: string;
  area: string;
  layout: string;
  floor: string;
  floorScore: string;
  orientation: string;
  orientationScore: string;
  buildYear: string;
  decoration: string;
  metroDistance: string;
  commuteTime: string;
  transportScore: string;
  school: string;
  schoolScore: string;
  communityScore: string;
  decorationScore: string;
  propertyFee: string;
  notes: string;
}

const HOUSE_LIMIT = 10;
const COLORS = ["#1e3a5f", "#ff6b35", "#0ea5e9", "#16a34a", "#8b5cf6", "#f59e0b", "#ec4899"];

const templateLabels: Record<TemplateId, string> = {
  school: "学区优先型",
  commute: "通勤优先型",
  value: "性价比优先型",
  family: "家庭改善型",
};

function getInitialFormState(): HouseFormState {
  return {
    name: "",
    totalPrice: "",
    area: "",
    layout: "3室2厅1卫",
    floor: "",
    floorScore: "3",
    orientation: "南",
    orientationScore: "3",
    buildYear: "",
    decoration: "简装",
    metroDistance: "",
    commuteTime: "",
    transportScore: "3",
    school: "",
    schoolScore: "3",
    communityScore: "3",
    decorationScore: "3",
    propertyFee: "",
    notes: "",
  };
}

function clampScore(value: number) {
  if (Number.isNaN(value)) return 3;
  return Math.max(1, Math.min(5, value));
}

function normalizeDimensions(input: ScoreDimension[]) {
  const total = input.reduce((sum, item) => sum + item.weight, 0);

  if (total <= 0) {
    const equalWeight = 100 / input.length;
    return input.map((item) => ({ ...item, weight: equalWeight }));
  }

  return input.map((item) => ({ ...item, weight: (item.weight / total) * 100 }));
}

function applyTemplate(template: TemplateId, dimensions: ScoreDimension[]) {
  const templateWeights: Partial<Record<string, number>> = {
    ...(template === "school" ? { school: 30, price: 20, transport: 15, area: 15 } : {}),
    ...(template === "commute" ? { transport: 30, price: 25, area: 15 } : {}),
    ...(template === "value" ? { price: 35, area: 20, decoration: 15 } : {}),
    ...(template === "family" ? { area: 25, community: 20, school: 15, orientation: 15 } : {}),
  };

  const fixedTotal = Object.values(templateWeights).reduce<number>(
    (sum, weight) => sum + (weight ?? 0),
    0,
  );
  const rest = dimensions.filter((item) => templateWeights[item.key] === undefined);
  const restWeight = rest.length > 0 ? Math.max(0, (100 - fixedTotal) / rest.length) : 0;

  return normalizeDimensions(
    dimensions.map((item) => ({
      ...item,
      weight: templateWeights[item.key] ?? restWeight,
    })),
  );
}

function getRangeScore(value: number, values: number[], reverse = false) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) return 3;

  const normalized = (value - min) / (max - min);
  const score = reverse ? (1 - normalized) * 4 + 1 : normalized * 4 + 1;
  return Math.max(1, Math.min(5, score));
}

function getScoreCellClass(score: number) {
  if (score >= 4) return "text-emerald-700 font-medium";
  if (score <= 2) return "text-rose-600 font-medium";
  return "text-slate-500";
}

export default function ComparePage() {
  const [houses, setHouses] = useLocalStorage<HouseItem[]>(STORAGE_KEYS.houses, []);
  const [dimensions, setDimensions] = useLocalStorage<ScoreDimension[]>(
    STORAGE_KEYS.dimensions,
    DEFAULT_DIMENSIONS,
  );
  const [formState, setFormState] = useState<HouseFormState>(getInitialFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [hiddenHouseIds, setHiddenHouseIds] = useState<string[]>([]);
  const [isWeightOpen, setIsWeightOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isDbPanelOpen, setIsDbPanelOpen] = useState(false);
  const [dbKeyword, setDbKeyword] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbCommunities, setDbCommunities] = useState<CommunitySummary[]>([]);
  const [dbSelectedCommunity, setDbSelectedCommunity] = useState<CommunitySummary | null>(null);
  const [dbListings, setDbListings] = useState<ListingItem[]>([]);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const houseScores = useMemo(() => {
    const unitPrices = houses.map((house) => house.unitPrice);
    const areas = houses.map((house) => house.area);

    return houses.map((house) => {
      const scoreMap: Record<string, number> = {
        price: getRangeScore(house.unitPrice, unitPrices, true),
        area: getRangeScore(house.area, areas, false),
        floor: house.floorScore,
        orientation: house.orientationScore,
        transport: house.transportScore,
        school: house.schoolScore,
        community: house.communityScore,
        decoration: house.decorationScore,
      };

      const totalScore = dimensions.reduce(
        (sum, dimension) => sum + scoreMap[dimension.key] * (dimension.weight / 100),
        0,
      );

      return {
        house,
        scoreMap,
        totalScore,
      };
    });
  }, [houses, dimensions]);

  const ranking = useMemo(
    () => [...houseScores].sort((a, b) => b.totalScore - a.totalScore),
    [houseScores],
  );

  const radarData = useMemo(
    () =>
      dimensions.map((dimension) => {
        const row: Record<string, string | number> = {
          dimension: dimension.label,
        };
        houseScores.forEach((houseScore) => {
          row[houseScore.house.id] = Number(houseScore.scoreMap[dimension.key].toFixed(2));
        });
        return row;
      }),
    [dimensions, houseScores],
  );

  function resetForm() {
    setFormState(getInitialFormState());
    setEditingId(null);
  }

  function openAddForm() {
    if (houses.length >= HOUSE_LIMIT) return;
    resetForm();
    setIsFormOpen(true);
  }

  function openEditForm(house: HouseItem) {
    setEditingId(house.id);
    setFormState({
      name: house.name,
      totalPrice: String(house.totalPrice),
      area: String(house.area),
      layout: house.layout,
      floor: house.floor,
      floorScore: String(house.floorScore),
      orientation: house.orientation,
      orientationScore: String(house.orientationScore),
      buildYear: house.buildYear ? String(house.buildYear) : "",
      decoration: house.decoration,
      metroDistance: house.metroDistance ? String(house.metroDistance) : "",
      commuteTime: house.commuteTime ? String(house.commuteTime) : "",
      transportScore: String(house.transportScore),
      school: house.school,
      schoolScore: String(house.schoolScore),
      communityScore: String(house.communityScore),
      decorationScore: String(house.decorationScore),
      propertyFee: house.propertyFee ? String(house.propertyFee) : "",
      notes: house.notes ?? "",
    });
    setIsFormOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const totalPrice = Number(formState.totalPrice);
    const area = Number(formState.area);

    if (!formState.name.trim() || totalPrice <= 0 || area <= 0) {
      window.alert("请至少填写：房源名称、总价、面积（且大于0）");
      return;
    }

    const item: HouseItem = {
      id: editingId ?? `${Date.now()}`,
      name: formState.name.trim(),
      totalPrice,
      area,
      unitPrice: (totalPrice * 10000) / area,
      layout: formState.layout.trim() || "未填写",
      floor: formState.floor.trim() || "未填写",
      floorScore: clampScore(Number(formState.floorScore)),
      orientation: formState.orientation.trim() || "未填写",
      orientationScore: clampScore(Number(formState.orientationScore)),
      buildYear: formState.buildYear ? Number(formState.buildYear) : undefined,
      decoration: formState.decoration.trim() || "未填写",
      metroDistance: formState.metroDistance ? Number(formState.metroDistance) : undefined,
      commuteTime: formState.commuteTime ? Number(formState.commuteTime) : undefined,
      transportScore: clampScore(Number(formState.transportScore)),
      school: formState.school.trim() || "未填写",
      schoolScore: clampScore(Number(formState.schoolScore)),
      communityScore: clampScore(Number(formState.communityScore)),
      decorationScore: clampScore(Number(formState.decorationScore)),
      propertyFee: formState.propertyFee ? Number(formState.propertyFee) : undefined,
      notes: formState.notes.trim() || undefined,
      createdAt: editingId
        ? houses.find((house) => house.id === editingId)?.createdAt ?? Date.now()
        : Date.now(),
    };

    if (editingId) {
      setHouses((prev) => prev.map((house) => (house.id === editingId ? item : house)));
    } else {
      setHouses((prev) => [...prev, item]);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }

    setIsFormOpen(false);
    resetForm();
  }

  function removeHouse(id: string) {
    setHouses((prev) => prev.filter((house) => house.id !== id));
  }

  function updateWeight(key: string, weight: number) {
    const next = dimensions.map((dimension) =>
      dimension.key === key ? { ...dimension, weight: Math.max(0, weight) } : dimension,
    );
    setDimensions(normalizeDimensions(next));
  }

  function toggleHouse(id: string) {
    setHiddenHouseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  async function handleSearchCommunities() {
    const keyword = dbKeyword.trim();
    if (!keyword) return;

    setDbLoading(true);
    setDbError(null);
    setDbSelectedCommunity(null);
    setDbListings([]);

    try {
      const list = await searchCommunities(keyword);
      setDbCommunities(list);
      if (list.length === 0) {
        setDbError("没有匹配小区，请换关键词。");
      }
    } catch {
      setDbError("后端暂不可用，请先启动后端服务。");
      setDbCommunities([]);
    } finally {
      setDbLoading(false);
    }
  }

  async function chooseCommunity(community: CommunitySummary) {
    setDbSelectedCommunity(community);
    setDbLoading(true);
    setDbError(null);
    try {
      const data = await getListings({ community_id: community.id, status: "active", size: 20, page: 1 });
      setDbListings(data.items ?? []);
      if (!data.items?.length) {
        setDbError("该小区暂无可导入在售房源。");
      }
    } catch {
      setDbError("房源列表获取失败，请稍后再试。");
      setDbListings([]);
    } finally {
      setDbLoading(false);
    }
  }

  function importListing(listing: ListingItem) {
    if (houses.length >= HOUSE_LIMIT) {
      setDbError(`最多仅支持 ${HOUSE_LIMIT} 套房源对比。`);
      return;
    }

    const totalPrice = Number(listing.total_price ?? 0);
    const area = Number(listing.area ?? 0);
    const unitPrice = Number(listing.unit_price ?? 0);

    if (totalPrice <= 0 || area <= 0) {
      setDbError("该房源缺少关键价格或面积字段，无法导入。");
      return;
    }

    const imported: HouseItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: listing.title || `${dbSelectedCommunity?.name ?? "小区房源"}（数据库）`,
      totalPrice,
      area,
      unitPrice: unitPrice > 0 ? unitPrice : (totalPrice * 10000) / area,
      layout: listing.layout || "未填写",
      floor: listing.floor_info || "未填写",
      floorScore: 3,
      orientation: listing.orientation || "未填写",
      orientationScore: 3,
      buildYear: listing.build_year,
      decoration: listing.decoration || "未填写",
      transportScore: 3,
      school: "未填写",
      schoolScore: 3,
      communityScore: 3,
      decorationScore: 3,
      notes: "来源：后端数据库导入",
      createdAt: Date.now(),
    };

    setHouses((prev) => [...prev, imported]);
    setDbError("导入成功，可在表单中继续完善评分和备注。");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  async function handleExportImage() {
    if (!resultRef.current) return;
    setIsExporting(true);
    setExportFeedback(null);
    try {
      const canvas = await html2canvas(resultRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `fasthousing-compare-${Date.now()}.png`;
      link.click();
      setExportFeedback("导出成功：图片已开始下载。");
    } catch (error) {
      setExportFeedback(getExportErrorMessage(error, "导出失败，请稍后重试。"));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">房源对比器</h1>
          <p className="mt-1 text-sm text-slate-600">
            手动录入最多 {HOUSE_LIMIT} 套房源，按你的偏好权重进行智能对比。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {houses.length >= 2 ? (
            <button
              type="button"
              onClick={handleExportImage}
              disabled={isExporting}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? "导出中..." : "导出图片"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsDbPanelOpen((prev) => !prev)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
          >
            从数据库搜索
          </button>
          <button
            type="button"
            onClick={openAddForm}
            disabled={houses.length >= HOUSE_LIMIT}
            className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            添加房源
          </button>
        </div>
      </div>
      {exportFeedback ? (
        <p
          className={`text-xs ${
            exportFeedback.startsWith("导出成功") ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {exportFeedback}
        </p>
      ) : null}
      {isDbPanelOpen ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">从数据库导入房源</h2>
          <div className="flex gap-2">
            <input
              value={dbKeyword}
              onChange={(e) => setDbKeyword(e.target.value)}
              placeholder="输入小区名（如：中远两湾城）"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSearchCommunities}
              disabled={dbLoading}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-700 disabled:opacity-60"
            >
              {dbLoading ? "搜索中..." : "搜索小区"}
            </button>
          </div>
          {dbError ? (
            <p className={`text-xs ${dbError.includes("成功") ? "text-emerald-600" : "text-rose-600"}`}>
              {dbError}
            </p>
          ) : null}

          {dbCommunities.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {dbCommunities.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  onClick={() => chooseCommunity(community)}
                  className={`rounded-lg border p-3 text-left ${
                    dbSelectedCommunity?.id === community.id
                      ? "border-[var(--brand-primary)] bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900">{community.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{community.district ?? "未知区域"}</p>
                </button>
              ))}
            </div>
          ) : null}

          {dbSelectedCommunity ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">在售房源（{dbSelectedCommunity.name}）</p>
              {dbListings.length === 0 ? (
                <p className="text-xs text-slate-500">暂无可导入房源</p>
              ) : (
                <div className="space-y-2">
                  {dbListings.map((listing) => (
                    <article
                      key={listing.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                    >
                      <div>
                        <p className="text-sm text-slate-900">{listing.title || "未命名房源"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          总价 {Number(listing.total_price ?? 0).toFixed(1)} 万 · 面积{" "}
                          {Number(listing.area ?? 0).toFixed(1)} ㎡
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => importListing(listing)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        导入
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {isFormOpen ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-base font-semibold text-slate-900">{editingId ? "编辑房源" : "新增房源"}</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              value={formState.name}
              onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="房源名称/地址*"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={0}
              step="0.1"
              value={formState.totalPrice}
              onChange={(e) => setFormState((prev) => ({ ...prev, totalPrice: e.target.value }))}
              placeholder="总价（万元）*"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={0}
              step="0.1"
              value={formState.area}
              onChange={(e) => setFormState((prev) => ({ ...prev, area: e.target.value }))}
              placeholder="面积（㎡）*"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={formState.layout}
              onChange={(e) => setFormState((prev) => ({ ...prev, layout: e.target.value }))}
              placeholder="户型（如3室2厅1卫）"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={formState.floor}
              onChange={(e) => setFormState((prev) => ({ ...prev, floor: e.target.value }))}
              placeholder="楼层（如中楼层/共18层）"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={formState.orientation}
              onChange={(e) => setFormState((prev) => ({ ...prev, orientation: e.target.value }))}
              placeholder="朝向（如南北通透）"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={formState.decoration}
              onChange={(e) => setFormState((prev) => ({ ...prev, decoration: e.target.value }))}
              placeholder="装修状况"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={formState.school}
              onChange={(e) => setFormState((prev) => ({ ...prev, school: e.target.value }))}
              placeholder="学区信息"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              value={formState.metroDistance}
              onChange={(e) => setFormState((prev) => ({ ...prev, metroDistance: e.target.value }))}
              placeholder="地铁距离（米）"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              value={formState.commuteTime}
              onChange={(e) => setFormState((prev) => ({ ...prev, commuteTime: e.target.value }))}
              placeholder="通勤时间（分钟）"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1900}
              max={2100}
              value={formState.buildYear}
              onChange={(e) => setFormState((prev) => ({ ...prev, buildYear: e.target.value }))}
              placeholder="建筑年代"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              step="0.1"
              value={formState.propertyFee}
              onChange={(e) => setFormState((prev) => ({ ...prev, propertyFee: e.target.value }))}
              placeholder="物业费（元/㎡/月）"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
            <StarRating
              label="楼层评分"
              value={clampScore(Number(formState.floorScore))}
              onChange={(value) => setFormState((prev) => ({ ...prev, floorScore: String(value) }))}
            />
            <StarRating
              label="朝向评分"
              value={clampScore(Number(formState.orientationScore))}
              onChange={(value) => setFormState((prev) => ({ ...prev, orientationScore: String(value) }))}
            />
            <StarRating
              label="交通评分"
              value={clampScore(Number(formState.transportScore))}
              onChange={(value) => setFormState((prev) => ({ ...prev, transportScore: String(value) }))}
            />
            <StarRating
              label="学区评分"
              value={clampScore(Number(formState.schoolScore))}
              onChange={(value) => setFormState((prev) => ({ ...prev, schoolScore: String(value) }))}
            />
            <StarRating
              label="小区评分"
              value={clampScore(Number(formState.communityScore))}
              onChange={(value) => setFormState((prev) => ({ ...prev, communityScore: String(value) }))}
            />
            <StarRating
              label="装修评分"
              value={clampScore(Number(formState.decorationScore))}
              onChange={(value) => setFormState((prev) => ({ ...prev, decorationScore: String(value) }))}
            />
          </div>

          <textarea
            value={formState.notes}
            onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="备注"
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
            >
              {editingId ? "保存修改" : "保存房源"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">房源列表（{houses.length}/{HOUSE_LIMIT}）</h2>
        {houses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            还没有房源，点击右上角“添加房源”开始记录。
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {houses.map((house) => (
              <article key={house.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{house.name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(house)}
                      className="text-xs text-slate-500 underline underline-offset-2"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHouse(house.id)}
                      className="text-xs text-rose-500 underline underline-offset-2"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  总价 {house.totalPrice.toFixed(1)} 万 | 面积 {house.area.toFixed(1)} ㎡ | 单价{" "}
                  {(house.unitPrice / 10000).toFixed(2)} 万/㎡
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {house.layout} · {house.floor} · {house.orientation}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setIsWeightOpen((prev) => !prev)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-base font-semibold text-slate-900">权重设置</span>
          <span className="text-xs text-slate-500">{isWeightOpen ? "收起" : "展开"}</span>
        </button>
        {isWeightOpen ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(templateLabels) as TemplateId[]).map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => setDimensions(applyTemplate(template, dimensions))}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
                >
                  {templateLabels[template]}
                </button>
              ))}
            </div>
            {dimensions.map((dimension) => (
              <label key={dimension.key} className="block text-sm text-slate-700">
                <div className="mb-1 flex items-center justify-between">
                  <span>{dimension.label}</span>
                  <span className="text-xs text-slate-500">{dimension.weight.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={dimension.weight}
                  onChange={(event) => updateWeight(dimension.key, Number(event.target.value))}
                  className="w-full"
                />
              </label>
            ))}
            <p className="text-xs text-slate-500">
              权重总和：{dimensions.reduce((sum, item) => sum + item.weight, 0).toFixed(1)}%（自动归一化）
            </p>
          </div>
        ) : null}
      </section>

      <section ref={resultRef} className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">对比结果</h2>
        {houses.length < 2 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            添加至少 2 套房源开始对比。
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {houses.map((house, index) => (
                  <button
                    key={house.id}
                    type="button"
                    onClick={() => toggleHouse(house.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      !hiddenHouseIds.includes(house.id)
                        ? "border-slate-300 bg-slate-100 text-slate-800"
                        : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {house.name}
                  </button>
                ))}
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, 5]} tickCount={6} />
                    <Tooltip />
                    {houses.map((house, index) =>
                      !hiddenHouseIds.includes(house.id) ? (
                        <Radar
                          key={house.id}
                          name={house.name}
                          dataKey={house.id}
                          stroke={COLORS[index % COLORS.length]}
                          fill={COLORS[index % COLORS.length]}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      ) : null,
                    )}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {ranking.map((item, index) => (
                <article
                  key={item.house.id}
                  className={`rounded-xl border p-4 ${
                    index === 0 ? "border-[var(--brand-accent)] bg-orange-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      #{index + 1} {item.house.name}
                    </h3>
                    <span className="text-xs text-slate-500">总分 {item.totalScore.toFixed(2)} / 5</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    单价 {(item.house.unitPrice / 10000).toFixed(2)} 万/㎡ · {item.house.area} ㎡
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-xs font-medium text-emerald-700">Top3 优势</p>
                      <ul className="mt-2 space-y-1 text-xs text-emerald-800">
                        {dimensions
                          .map((dimension) => ({
                            label: dimension.label,
                            value: item.scoreMap[dimension.key],
                          }))
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 3)
                          .map((entry) => (
                            <li key={entry.label}>
                              {entry.label}（{entry.value.toFixed(1)}分）
                            </li>
                          ))}
                      </ul>
                    </div>
                    <div className="rounded-lg bg-rose-50 p-3">
                      <p className="text-xs font-medium text-rose-700">Top3 劣势</p>
                      <ul className="mt-2 space-y-1 text-xs text-rose-800">
                        {dimensions
                          .map((dimension) => ({
                            label: dimension.label,
                            value: item.scoreMap[dimension.key],
                          }))
                          .sort((a, b) => a.value - b.value)
                          .slice(0, 3)
                          .map((entry) => (
                            <li key={entry.label}>
                              {entry.label}（{entry.value.toFixed(1)}分）
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-[760px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium">维度</th>
                    {houses.map((house) => (
                      <th key={house.id} className="px-3 py-2 font-medium">
                        {house.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "总分",
                      getValue: (house: HouseItem) =>
                        houseScores.find((item) => item.house.id === house.id)?.totalScore.toFixed(2) ?? "-",
                    },
                    { label: "总价（万）", getValue: (house: HouseItem) => house.totalPrice.toFixed(1) },
                    { label: "面积（㎡）", getValue: (house: HouseItem) => house.area.toFixed(1) },
                    {
                      label: "单价（万/㎡）",
                      getValue: (house: HouseItem) => (house.unitPrice / 10000).toFixed(2),
                    },
                    { label: "户型", getValue: (house: HouseItem) => house.layout },
                    { label: "楼层", getValue: (house: HouseItem) => house.floor },
                    { label: "朝向", getValue: (house: HouseItem) => house.orientation },
                    { label: "学区", getValue: (house: HouseItem) => house.school },
                    {
                      label: "楼层评分",
                      getValue: (house: HouseItem) => house.floorScore.toFixed(1),
                      scoreValue: (house: HouseItem) => house.floorScore,
                    },
                    {
                      label: "朝向评分",
                      getValue: (house: HouseItem) => house.orientationScore.toFixed(1),
                      scoreValue: (house: HouseItem) => house.orientationScore,
                    },
                    {
                      label: "交通评分",
                      getValue: (house: HouseItem) => house.transportScore.toFixed(1),
                      scoreValue: (house: HouseItem) => house.transportScore,
                    },
                    {
                      label: "学区评分",
                      getValue: (house: HouseItem) => house.schoolScore.toFixed(1),
                      scoreValue: (house: HouseItem) => house.schoolScore,
                    },
                    {
                      label: "小区品质",
                      getValue: (house: HouseItem) => house.communityScore.toFixed(1),
                      scoreValue: (house: HouseItem) => house.communityScore,
                    },
                    {
                      label: "装修评分",
                      getValue: (house: HouseItem) => house.decorationScore.toFixed(1),
                      scoreValue: (house: HouseItem) => house.decorationScore,
                    },
                  ].map((row) => (
                    <tr key={row.label} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-xs text-slate-500">{row.label}</td>
                      {houses.map((house) => (
                        <td
                          key={`${row.label}-${house.id}`}
                          className={`px-3 py-2 text-slate-700 ${
                            row.scoreValue ? getScoreCellClass(row.scoreValue(house)) : ""
                          }`}
                        >
                          {row.getValue(house)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
