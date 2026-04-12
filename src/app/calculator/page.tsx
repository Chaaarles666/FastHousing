"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  calcEqualInstallmentMonthlyPayment,
  calcEqualPrincipalFirstMonthPayment,
  calcMaxPurchasePower,
  calcMonthlyInvestmentIncome,
  calcTaxes,
  inverseLoanFromPayment,
} from "@/lib/calculations";
import { SHANGHAI_CONFIG, STORAGE_KEYS } from "@/lib/constants";
import { getExportErrorMessage } from "@/lib/export";
import { FinancialProfile } from "@/lib/types";

type RiskLevel = "good" | "warn" | "danger";
type LimitType = "payment" | "downpayment";

interface AffordabilityRange {
  totalPrice: number;
  limitedBy: LimitType;
}

interface PaymentStrategy {
  name: string;
  downPayment: number;
  loanAmount: number;
  providentLoan: number;
  commercialLoan: number;
  monthlyPayment: number;
  remainingSavings: number;
  investmentIncome: number;
  netMonthlyCost: number;
  totalInterest: number;
  totalCost: number;
  recommended: boolean;
  reason: string;
}

const DEFAULT_PROFILE: FinancialProfile = {
  monthlyIncome: 30000,
  spouseIncome: 20000,
  otherIncome: 0,
  monthlyExpense: 12000,
  savings: 120,
  providentBalance: 30,
  providentMonthly: 8000,
  investmentReturn: SHANGHAI_CONFIG.defaults.investmentReturn,
  existingMortgage: 0,
  carLoan: 0,
  otherDebt: 0,
  targetPrice: 500,
  targetArea: 90,
  isFirstHome: true,
  isFullFiveUnique: false,
  isOverTwoYears: true,
  loanYears: 30,
  familySize: 2,
};

function formatWan(value: number) {
  return `${Math.max(0, value).toFixed(1)} 万`;
}

function formatMoney(value: number) {
  return `¥${Math.round(Math.max(0, value)).toLocaleString("zh-CN")}`;
}

function getRiskLevel(value: number, good: number, warn: number): RiskLevel {
  if (value <= good) return "good";
  if (value <= warn) return "warn";
  return "danger";
}

function riskClass(level: RiskLevel) {
  if (level === "good") return "text-emerald-700 bg-emerald-50";
  if (level === "warn") return "text-amber-700 bg-amber-50";
  return "text-rose-700 bg-rose-50";
}

function feasibilityBg(canAfford: boolean, gap: number, targetPrice: number) {
  if (canAfford) return "linear-gradient(135deg, #059669, #047857)";
  if (gap < targetPrice * 0.1) return "linear-gradient(135deg, #d97706, #b45309)";
  return "linear-gradient(135deg, #dc2626, #b91c1c)";
}

function limitText(limit: LimitType) {
  return limit === "downpayment" ? "受首付能力限制" : "受月供承受力限制";
}

export default function CalculatorPage() {
  const [profile, setProfile] = useLocalStorage<FinancialProfile>(STORAGE_KEYS.calculator, DEFAULT_PROFILE);
  const [debouncedProfile, setDebouncedProfile] = useState<FinancialProfile>(profile);
  const [rateShift, setRateShift] = useState(0);
  const [prepayAmount, setPrepayAmount] = useState(20);
  const [incomeDrop, setIncomeDrop] = useState(20);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProfile(profile), 300);
    return () => window.clearTimeout(timer);
  }, [profile]);

  const calc = useMemo(() => {
    const downPaymentRate = debouncedProfile.isFirstHome ? SHANGHAI_CONFIG.downPayment.first : SHANGHAI_CONFIG.downPayment.second;
    const commercialRate = debouncedProfile.isFirstHome ? SHANGHAI_CONFIG.commercial.rateFirst : SHANGHAI_CONFIG.commercial.rateSecond;
    const providentRate = debouncedProfile.isFirstHome ? SHANGHAI_CONFIG.provident.rateFirst : SHANGHAI_CONFIG.provident.rateSecond;
    const taxes = calcTaxes(debouncedProfile);

    const totalIncome = debouncedProfile.monthlyIncome + debouncedProfile.spouseIncome + debouncedProfile.otherIncome;
    const totalDebt = debouncedProfile.existingMortgage + debouncedProfile.carLoan + debouncedProfile.otherDebt;
    const spendable = Math.max(0, totalIncome - debouncedProfile.monthlyExpense - totalDebt);

    const availableCash = debouncedProfile.savings + debouncedProfile.providentBalance;
    const minDownPayment = debouncedProfile.targetPrice * downPaymentRate;
    const minCashNeeded = minDownPayment + taxes.total;
    const canAfford = availableCash >= minCashNeeded;
    const cashGap = Math.max(0, minCashNeeded - availableCash);
    const maxPurchasePower = calcMaxPurchasePower(debouncedProfile);

    const calcRange = (ratio: number): AffordabilityRange => {
      const loanByPayment = inverseLoanFromPayment(spendable * ratio, commercialRate, debouncedProfile.loanYears);
      const totalByPayment = (loanByPayment / 10000) / (1 - downPaymentRate);
      const availableForDown = Math.max(
        0,
        debouncedProfile.savings + debouncedProfile.providentBalance - (debouncedProfile.monthlyExpense * 6) / 10000,
      );
      const totalByDown = availableForDown / (downPaymentRate + 0.05);
      return {
        totalPrice: Math.max(0, Math.min(totalByPayment, totalByDown)),
        limitedBy: totalByDown < totalByPayment ? "downpayment" : "payment",
      };
    };

    const conservative = calcRange(0.3);
    const moderate = calcRange(0.4);
    const aggressive = calcRange(0.5);

    const months = debouncedProfile.loanYears * 12;
    const providentCap = debouncedProfile.familySize > 1 ? SHANGHAI_CONFIG.provident.maxFamily : SHANGHAI_CONFIG.provident.maxSingle;

    const calcStrategy = (name: string, downRaw: number): PaymentStrategy => {
      const downPayment = Math.min(debouncedProfile.targetPrice, Math.max(minDownPayment, downRaw));
      const loanAmount = Math.max(0, debouncedProfile.targetPrice - downPayment);
      const providentLoan = Math.min(loanAmount, providentCap);
      const commercialLoan = Math.max(0, loanAmount - providentLoan);
      const monthlyPayment =
        calcEqualInstallmentMonthlyPayment(providentLoan * 10000, providentRate, debouncedProfile.loanYears) +
        calcEqualInstallmentMonthlyPayment(commercialLoan * 10000, commercialRate, debouncedProfile.loanYears);
      const totalInterest =
        ((calcEqualInstallmentMonthlyPayment(providentLoan * 10000, providentRate, debouncedProfile.loanYears) * months - providentLoan * 10000) +
          (calcEqualInstallmentMonthlyPayment(commercialLoan * 10000, commercialRate, debouncedProfile.loanYears) * months - commercialLoan * 10000)) /
        10000;
      const remainingSavings = Math.max(0, availableCash - downPayment - taxes.total);
      const investmentIncome = calcMonthlyInvestmentIncome(remainingSavings, debouncedProfile.investmentReturn);
      const netMonthlyCost = monthlyPayment - investmentIncome;
      const totalCost = debouncedProfile.targetPrice + taxes.total + totalInterest - (investmentIncome * months) / 10000;

      return {
        name,
        downPayment,
        loanAmount,
        providentLoan,
        commercialLoan,
        monthlyPayment,
        remainingSavings,
        investmentIncome,
        netMonthlyCost,
        totalInterest,
        totalCost,
        recommended: false,
        reason: "",
      };
    };

    const strategyA = calcStrategy("最低首付型", minDownPayment);
    const strategyB = calcStrategy(
      "平衡型",
      Math.min(debouncedProfile.targetPrice * 0.5, availableCash - taxes.total - (debouncedProfile.monthlyExpense * 12) / 10000),
    );
    const strategyC = calcStrategy(
      "多付首付型",
      Math.min(debouncedProfile.targetPrice * 0.8, availableCash - taxes.total - (debouncedProfile.monthlyExpense * 6) / 10000),
    );
    const strategies = [strategyA, strategyB, strategyC];
    const investRate = debouncedProfile.investmentReturn / 100;
    if (investRate > commercialRate + 0.005) {
      strategyA.recommended = true;
      strategyA.reason = "投资回报高于贷款利率，少付首付更划算。";
    } else if (investRate < commercialRate - 0.005) {
      strategyC.recommended = true;
      strategyC.reason = "贷款利率更高，多付首付可显著降低总成本。";
    } else {
      strategyB.recommended = true;
      strategyB.reason = "贷款与投资收益接近，平衡策略更稳。";
    }
    const recommended = strategies.find((item) => item.recommended) ?? strategyB;

    const lifeIncome = totalIncome + recommended.investmentIncome;
    const lifeExpense = debouncedProfile.monthlyExpense + totalDebt;
    const disposable = lifeIncome - recommended.monthlyPayment - lifeExpense;
    const paymentToIncomeRatio = totalIncome > 0 ? recommended.monthlyPayment / totalIncome : 0;
    const dti = totalIncome > 0 ? (recommended.monthlyPayment + totalDebt) / totalIncome : 0;
    const emergencyMonths = lifeExpense > 0 ? (recommended.remainingSavings * 10000) / lifeExpense : 0;
    const incomeDropThreshold = totalIncome > 0 ? Math.max(0, Math.min(100, (1 - (recommended.monthlyPayment + lifeExpense - recommended.investmentIncome) / totalIncome) * 100)) : 0;

    const pool = Math.max(1, lifeIncome);
    const paymentRatio = Math.min(100, (recommended.monthlyPayment / pool) * 100);
    const expenseRatio = Math.min(100, (lifeExpense / pool) * 100);
    const disposableRatio = Math.max(0, 100 - paymentRatio - expenseRatio);

    const shiftedMonthly =
      calcEqualInstallmentMonthlyPayment(recommended.providentLoan * 10000, providentRate, debouncedProfile.loanYears) +
      calcEqualInstallmentMonthlyPayment(recommended.commercialLoan * 10000, commercialRate + rateShift / 100, debouncedProfile.loanYears);

    const prepaySaveEstimate = Math.max(0, (prepayAmount * 10000 * commercialRate * Math.max(1, debouncedProfile.loanYears - 5)) / 2);
    const droppedDisposable = totalIncome * (1 - incomeDrop / 100) + recommended.investmentIncome - recommended.monthlyPayment - lifeExpense;
    const principalFirst =
      calcEqualPrincipalFirstMonthPayment(recommended.providentLoan * 10000, providentRate, debouncedProfile.loanYears) +
      calcEqualPrincipalFirstMonthPayment(recommended.commercialLoan * 10000, commercialRate, debouncedProfile.loanYears);

    return {
      downPaymentRate,
      commercialRate,
      taxes,
      availableCash,
      minDownPayment,
      minCashNeeded,
      canAfford,
      cashGap,
      maxPurchasePower,
      affordablePrice: Math.min(maxPurchasePower, debouncedProfile.targetPrice),
      conservative,
      moderate,
      aggressive,
      strategies,
      recommended,
      lifeIncome,
      lifeExpense,
      disposable,
      paymentToIncomeRatio,
      dti,
      emergencyMonths,
      incomeDropThreshold,
      paymentRatio,
      expenseRatio,
      disposableRatio,
      shiftedMonthly,
      prepaySaveEstimate,
      droppedDisposable,
      principalFirst,
    };
  }, [debouncedProfile, rateShift, prepayAmount, incomeDrop]);

  function setNumber<K extends keyof FinancialProfile>(key: K, value: string) {
    const parsed = Number(value);
    setProfile((prev) => ({ ...prev, [key]: Number.isNaN(parsed) ? 0 : parsed }));
  }

  async function handleExportPdf() {
    if (!reportRef.current) return;
    setIsExporting(true);
    setExportFeedback(null);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imageHeight;
      let position = 0;
      pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`fasthousing-calculator-v2-${Date.now()}.pdf`);
      setExportFeedback("导出成功：PDF 已开始下载。");
    } catch (error) {
      setExportFeedback(getExportErrorMessage(error, "PDF 导出失败，请稍后重试。"));
    } finally {
      setIsExporting(false);
    }
  }

  const quickCards = [
    { label: "月供收入比", value: `${(calc.paymentToIncomeRatio * 100).toFixed(1)}%`, level: getRiskLevel(calc.paymentToIncomeRatio, 0.3, 0.5), desc: "建议 ≤ 35%" },
    { label: "负债收入比(DTI)", value: `${(calc.dti * 100).toFixed(1)}%`, level: getRiskLevel(calc.dti, 0.45, 0.55), desc: "建议 ≤ 45%" },
    { label: "应急储备", value: `${calc.emergencyMonths.toFixed(1)} 月`, level: calc.emergencyMonths >= 6 ? "good" : calc.emergencyMonths >= 3 ? "warn" : "danger", desc: "建议 ≥ 6个月" },
    { label: "收入下降阈值", value: `${calc.incomeDropThreshold.toFixed(1)}%`, level: calc.incomeDropThreshold >= 40 ? "good" : calc.incomeDropThreshold >= 20 ? "warn" : "danger", desc: "跌破后压力明显上升" },
  ] as const;

  return (
    <div ref={reportRef} className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">购房能力评估</h1>
        <p className="mt-2 text-sm text-slate-600">新模型：先判断目标房价是否可行，再给出最优付款策略与买后财务画像。</p>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={handleExportPdf} disabled={isExporting} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
            {isExporting ? "导出中..." : "导出 PDF 报告"}
          </button>
          {profile !== debouncedProfile ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">计算中...</span> : null}
        </div>
        {exportFeedback ? <p className={`mt-2 text-xs ${exportFeedback.startsWith("导出成功") ? "text-emerald-600" : "text-rose-600"}`}>{exportFeedback}</p> : null}
      </div>

      <section className="rounded-2xl p-6 text-white shadow-lg" style={{ background: feasibilityBg(calc.canAfford, calc.cashGap, profile.targetPrice) }}>
        <p className="text-lg font-bold">{calc.canAfford ? "🟢 这套房你买得起" : `🔴 还差 ${formatWan(calc.cashGap)}`}</p>
        <p className="mt-1 text-sm opacity-90">目标总价 {formatWan(profile.targetPrice)} · 购买力上限约 {formatWan(calc.maxPurchasePower)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/20 px-2 py-1 text-xs">最低首付 {formatWan(calc.minDownPayment)}</span>
          <span className="rounded-full bg-white/20 px-2 py-1 text-xs">需准备现金 {formatWan(calc.minCashNeeded)}</span>
          <span className="rounded-full bg-white/20 px-2 py-1 text-xs">推荐月供 {formatMoney(calc.recommended.monthlyPayment)}</span>
        </div>
        {!calc.canAfford ? (
          <div className="mt-3 rounded-lg bg-white/15 p-3 text-sm">
            <p>可用资金：{formatWan(calc.availableCash)}，当前缺口：{formatWan(calc.cashGap)}</p>
            <p className="mt-1">建议降价至 {formatWan(calc.affordablePrice)}，或补充首付 {formatWan(calc.cashGap)}。</p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">家庭财务信息</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600">本人月收入（元）<input type="number" value={profile.monthlyIncome} onChange={(e) => setNumber("monthlyIncome", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">配偶月收入（元）<input type="number" value={profile.spouseIncome} onChange={(e) => setNumber("spouseIncome", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">其他月收入（元）<input type="number" value={profile.otherIncome} onChange={(e) => setNumber("otherIncome", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">月固定开支（元）<input type="number" value={profile.monthlyExpense} onChange={(e) => setNumber("monthlyExpense", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">可动用存款（万）<input type="number" value={profile.savings} onChange={(e) => setNumber("savings", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">公积金余额（万）<input type="number" value={profile.providentBalance} onChange={(e) => setNumber("providentBalance", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">现有房贷月供（元）<input type="number" value={profile.existingMortgage} onChange={(e) => setNumber("existingMortgage", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">车贷月供（元）<input type="number" value={profile.carLoan} onChange={(e) => setNumber("carLoan", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">其他负债（元）<input type="number" value={profile.otherDebt} onChange={(e) => setNumber("otherDebt", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">年化收益率：{profile.investmentReturn}%<input type="range" min={0} max={8} step={0.5} value={profile.investmentReturn} onChange={(e) => setNumber("investmentReturn", e.target.value)} className="mt-2 w-full" /></label>
          </div>
        </div>
        <div className="rounded-xl border-2 border-dashed border-[var(--brand-accent)] bg-orange-50/50 p-4">
          <h2 className="text-base font-semibold text-slate-900">🏠 目标房产</h2>
          <div className="mt-3 grid gap-3">
            <label className="text-sm font-medium text-slate-700">目标总价（万元）<input type="number" value={profile.targetPrice} onChange={(e) => setNumber("targetPrice", e.target.value)} className="mt-1 w-full rounded-lg border-2 border-[var(--brand-accent)] px-4 py-3 text-2xl font-bold text-slate-900" /></label>
            <label className="text-xs text-slate-600">目标面积（㎡）<input type="number" value={profile.targetArea} onChange={(e) => setNumber("targetArea", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">贷款年限<input type="number" value={profile.loanYears} onChange={(e) => setNumber("loanYears", e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={profile.isFirstHome} onChange={(e) => setProfile((prev) => ({ ...prev, isFirstHome: e.target.checked }))} className="h-4 w-4 accent-[var(--brand-primary)]" />首套房</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={profile.isFullFiveUnique} onChange={(e) => setProfile((prev) => ({ ...prev, isFullFiveUnique: e.target.checked }))} className="h-4 w-4 accent-[var(--brand-primary)]" />满五唯一（免个税）</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={profile.isOverTwoYears} onChange={(e) => setProfile((prev) => ({ ...prev, isOverTwoYears: e.target.checked }))} className="h-4 w-4 accent-[var(--brand-primary)]" />满两年（免增值税）</label>
          </div>
        </div>
      </section>

      {calc.canAfford ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">付款策略对比</h2>
          <p className="mt-1 text-xs text-slate-500">
            投资收益率 {profile.investmentReturn}% vs 商贷利率 {(calc.commercialRate * 100).toFixed(2)}%
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {calc.strategies.map((s) => (
              <article key={s.name} className={`rounded-xl border-2 p-4 ${s.recommended ? "border-[var(--brand-accent)] bg-orange-50" : "border-slate-200 bg-white"}`}>
                {s.recommended ? <span className="rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-xs text-white">⭐ 推荐</span> : null}
                <h3 className="mt-2 text-sm font-semibold">{s.name}</h3>
                <p className="mt-1 text-xs text-slate-500">首付 {formatWan(s.downPayment)} · 贷款 {formatWan(s.loanAmount)}</p>
                <p className="mt-1 text-xs text-slate-500">公积金 {formatWan(s.providentLoan)} · 商贷 {formatWan(s.commercialLoan)}</p>
                <p className="mt-1 text-xs text-slate-500">月供 {formatMoney(s.monthlyPayment)} · 月投资收益 +{formatMoney(s.investmentIncome)}</p>
                <p className="mt-1 text-xs text-slate-500">净月支出 {s.netMonthlyCost <= 0 ? `净赚 ${formatMoney(Math.abs(s.netMonthlyCost))}` : formatMoney(s.netMonthlyCost)}</p>
                <p className="mt-1 text-xs text-slate-500">总利息 {formatWan(s.totalInterest)} · 30年总成本 {formatWan(s.totalCost)}</p>
                {s.recommended ? <p className="mt-2 text-xs text-orange-700">{s.reason}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">买后生活画像</h2>
        <div className="mt-4 flex h-8 overflow-hidden rounded-full text-[11px] text-white">
          <div style={{ width: `${calc.paymentRatio}%` }} className="flex items-center justify-center bg-blue-500">月供</div>
          <div style={{ width: `${calc.expenseRatio}%` }} className="flex items-center justify-center bg-slate-400">开支</div>
          <div style={{ width: `${calc.disposableRatio}%` }} className="flex items-center justify-center bg-emerald-500">可支配</div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p className="rounded-lg bg-slate-50 p-3 text-sm">月收入（含投资）：{formatMoney(calc.lifeIncome)}</p>
          <p className="rounded-lg bg-slate-50 p-3 text-sm">月供：{formatMoney(calc.recommended.monthlyPayment)}</p>
          <p className="rounded-lg bg-slate-50 p-3 text-sm">生活开支：{formatMoney(calc.lifeExpense)}</p>
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">每月可支配：{formatMoney(calc.disposable)}</p>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          收入下降阈值约 {calc.incomeDropThreshold.toFixed(1)}%，超过后每月缓冲将明显收缩。
        </p>
      </section>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
        {quickCards.map((card) => (
          <div key={card.label} className={`rounded-lg p-3 text-sm ${riskClass(card.level)}`}>
            <p>{card.label}</p><p className="mt-1 text-base font-semibold">{card.value}</p><p className="mt-1 text-xs opacity-80">{card.desc}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">场景模拟器</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><p>利率变动（±1%）</p><input type="range" min={-1} max={1} step={0.1} value={rateShift} onChange={(e) => setRateShift(Number(e.target.value))} className="mt-2 w-full" /><p className="mt-1 text-xs text-slate-600">月供：{formatMoney(calc.shiftedMonthly)}</p></div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><p>提前还贷模拟</p><input type="number" value={prepayAmount} onChange={(e) => setPrepayAmount(Number(e.target.value) || 0)} className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm" /><p className="mt-1 text-xs text-slate-600">预计省息：{formatMoney(calc.prepaySaveEstimate)}</p></div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><p>收入下降压力测试</p><select value={incomeDrop} onChange={(e) => setIncomeDrop(Number(e.target.value))} className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"><option value={20}>下降20%</option><option value={30}>下降30%</option><option value={40}>下降40%</option></select><p className="mt-1 text-xs text-slate-600">下降后月结余：{formatMoney(calc.droppedDisposable)}</p></div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><p>等额本息 vs 等额本金</p><p className="mt-1 text-xs text-slate-600">本息月供：{formatMoney(calc.recommended.monthlyPayment)}</p><p className="mt-1 text-xs text-slate-600">本金首月：{formatMoney(calc.principalFirst)}</p></div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h3 className="font-semibold text-slate-900">税费明细</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <p className="rounded-lg bg-slate-50 p-2">契税：{formatMoney(calc.taxes.deedTax)}</p>
          <p className="rounded-lg bg-slate-50 p-2">增值税：{formatMoney(calc.taxes.vat)}</p>
          <p className="rounded-lg bg-slate-50 p-2">个税：{formatMoney(calc.taxes.incomeTax)}</p>
          <p className="rounded-lg bg-slate-50 p-2">中介费：{formatMoney(calc.taxes.agencyFee)}</p>
        </div>
        <p className="mt-2">税费合计：<span className="font-semibold">{formatWan(calc.taxes.total)}</span></p>
      </section>

      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-slate-700">💡 参考：你的购买力区间</summary>
        <div className="border-t border-slate-100 p-4">
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-emerald-700">保守（月供≤30%）</p>
              <p className="font-semibold text-emerald-800">{formatWan(calc.conservative.totalPrice)}</p>
              <p className="mt-1 text-xs text-emerald-700">{limitText(calc.conservative.limitedBy)}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-blue-700">适中（月供≤40%）</p>
              <p className="font-semibold text-blue-800">{formatWan(calc.moderate.totalPrice)}</p>
              <p className="mt-1 text-xs text-blue-700">{limitText(calc.moderate.limitedBy)}</p>
            </div>
            <div className="rounded-lg bg-orange-50 p-3">
              <p className="text-orange-700">激进（月供≤50%）</p>
              <p className="font-semibold text-orange-800">{formatWan(calc.aggressive.totalPrice)}</p>
              <p className="mt-1 text-xs text-orange-700">{limitText(calc.aggressive.limitedBy)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">区间仅作参考，最终请以交易税费、银行审批和家庭风险偏好综合决策。</p>
        </div>
      </details>

      <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-700">完成评估后建议进入房源筛选：<Link href="/compare" className="ml-1 font-semibold underline underline-offset-2">去房源对比器</Link></p>
      <p className="text-xs leading-6 text-slate-500">以上计算仅供参考，不构成投资建议。实际以银行审批和最新政策为准。数据更新日期：{SHANGHAI_CONFIG.lastUpdated}</p>
    </div>
  );
}
