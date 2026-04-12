"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { calcEqualInstallmentMonthlyPayment, calcEqualPrincipalFirstMonthPayment } from "@/lib/calculations";
import { SHANGHAI_CONFIG, STORAGE_KEYS } from "@/lib/constants";
import { getExportErrorMessage } from "@/lib/export";
import { FinancialProfile } from "@/lib/types";

const DEFAULT_PROFILE: FinancialProfile = {
  monthlyIncome: 30000,
  spouseIncome: 20000,
  otherIncome: 0,
  monthlyExpense: 12000,
  savings: 120,
  providentBalance: 30,
  providentMonthly: 8000,
  existingMortgage: 0,
  carLoan: 0,
  otherDebt: 0,
  isFirstHome: true,
  familySize: 2,
  targetArea: 90,
  loanYears: 30,
};

type RiskLevel = "good" | "warn" | "danger";

function formatWan(value: number) {
  return `${value.toFixed(1)} 万`;
}

function formatMoney(value: number) {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function inverseLoanFromPayment(monthlyPayment: number, annualRate: number, years: number) {
  const monthlyRate = annualRate / 12;
  const months = years * 12;

  if (monthlyPayment <= 0 || months <= 0) return 0;
  if (monthlyRate <= 0) return monthlyPayment * months;

  const factor = Math.pow(1 + monthlyRate, months);
  return (monthlyPayment * (factor - 1)) / (monthlyRate * factor);
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
    const timer = window.setTimeout(() => {
      setDebouncedProfile(profile);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [profile]);

  const calculation = useMemo(() => {
    const totalIncome =
      debouncedProfile.monthlyIncome + debouncedProfile.spouseIncome + debouncedProfile.otherIncome;
    const totalDebt =
      debouncedProfile.existingMortgage + debouncedProfile.carLoan + debouncedProfile.otherDebt;
    const baseLivingCost = debouncedProfile.monthlyExpense + totalDebt;
    const spendable = Math.max(0, totalIncome - baseLivingCost);

    const downPaymentRate = debouncedProfile.isFirstHome
      ? SHANGHAI_CONFIG.downPayment.first
      : SHANGHAI_CONFIG.downPayment.second;
    const commercialRate = debouncedProfile.isFirstHome
      ? SHANGHAI_CONFIG.commercial.rateFirst
      : SHANGHAI_CONFIG.commercial.rateSecond;
    const providentRate = debouncedProfile.isFirstHome
      ? SHANGHAI_CONFIG.provident.rateFirst
      : SHANGHAI_CONFIG.provident.rateSecond;

    function calcRangeByRatio(ratio: number) {
      const paymentCap = spendable * ratio;
      const loanYuan = inverseLoanFromPayment(paymentCap, commercialRate, debouncedProfile.loanYears);
      const loanWan = loanYuan / 10000;
      const totalPrice = loanWan / (1 - downPaymentRate);
      return {
        paymentCap,
        loanWan,
        totalPrice,
      };
    }

    const conservative = calcRangeByRatio(0.3);
    const moderate = calcRangeByRatio(0.4);
    const aggressive = calcRangeByRatio(0.5);

    const availableCash = debouncedProfile.savings;
    const providentCash = debouncedProfile.providentBalance;
    const maxCash = availableCash + providentCash;
    const recommendedPrice = moderate.totalPrice;

    const downPaymentWan = recommendedPrice * downPaymentRate;
    const loanTotalWan = Math.max(0, recommendedPrice - downPaymentWan);
    const providentCap = debouncedProfile.familySize > 1 ? SHANGHAI_CONFIG.provident.maxFamily : SHANGHAI_CONFIG.provident.maxSingle;
    const providentLoanWan = Math.min(loanTotalWan, providentCap);
    const commercialLoanWan = Math.max(0, loanTotalWan - providentLoanWan);

    const pureProvidentWan = Math.min(loanTotalWan, providentCap);
    const pureCommercialWan = loanTotalWan;

    const months = debouncedProfile.loanYears * 12;

    const pureProvidentMonthly = calcEqualInstallmentMonthlyPayment(
      pureProvidentWan * 10000,
      providentRate,
      debouncedProfile.loanYears,
    );
    const pureProvidentPrincipalFirst = calcEqualPrincipalFirstMonthPayment(
      pureProvidentWan * 10000,
      providentRate,
      debouncedProfile.loanYears,
    );
    const pureProvidentInterest = pureProvidentMonthly * months - pureProvidentWan * 10000;

    const pureCommercialMonthly = calcEqualInstallmentMonthlyPayment(
      pureCommercialWan * 10000,
      commercialRate,
      debouncedProfile.loanYears,
    );
    const pureCommercialPrincipalFirst = calcEqualPrincipalFirstMonthPayment(
      pureCommercialWan * 10000,
      commercialRate,
      debouncedProfile.loanYears,
    );
    const pureCommercialInterest = pureCommercialMonthly * months - pureCommercialWan * 10000;

    const comboMonthly =
      calcEqualInstallmentMonthlyPayment(providentLoanWan * 10000, providentRate, debouncedProfile.loanYears) +
      calcEqualInstallmentMonthlyPayment(commercialLoanWan * 10000, commercialRate, debouncedProfile.loanYears);
    const comboPrincipalFirst =
      calcEqualPrincipalFirstMonthPayment(providentLoanWan * 10000, providentRate, debouncedProfile.loanYears) +
      calcEqualPrincipalFirstMonthPayment(commercialLoanWan * 10000, commercialRate, debouncedProfile.loanYears);
    const comboInterest = comboMonthly * months - loanTotalWan * 10000;

    const targetTotalYuan = recommendedPrice * 10000;
    const deedRate = debouncedProfile.isFirstHome
      ? debouncedProfile.targetArea <= 90
        ? SHANGHAI_CONFIG.tax.deed.firstSmall
        : SHANGHAI_CONFIG.tax.deed.firstLarge
      : debouncedProfile.targetArea <= 90
        ? SHANGHAI_CONFIG.tax.deed.secondSmall
        : SHANGHAI_CONFIG.tax.deed.secondLarge;

    const deedTax = targetTotalYuan * deedRate;
    const vat = targetTotalYuan * SHANGHAI_CONFIG.tax.vat;
    const incomeTax = targetTotalYuan * SHANGHAI_CONFIG.tax.incomeTax;
    const agencyFee = targetTotalYuan * SHANGHAI_CONFIG.tax.agencyFee;
    const totalTax = deedTax + vat + incomeTax + agencyFee;
    const renovationBudget = debouncedProfile.targetArea * 500;
    const totalCashNeed = downPaymentWan * 10000 + totalTax + renovationBudget;

    const monthlyIncomeRatio = totalIncome > 0 ? comboMonthly / totalIncome : 0;
    const dti = totalIncome > 0 ? (comboMonthly + totalDebt) / totalIncome : 0;
    const remainCashWan = maxCash - downPaymentWan - totalTax / 10000 - renovationBudget / 10000;
    const emergencyMonths =
      debouncedProfile.monthlyExpense > 0 ? (remainCashWan * 10000) / debouncedProfile.monthlyExpense : 0;
    const leverage = recommendedPrice > 0 ? loanTotalWan / recommendedPrice : 0;

    const shiftedRate = commercialRate + rateShift / 100;
    const shiftedMonthly = calcEqualInstallmentMonthlyPayment(
      loanTotalWan * 10000,
      shiftedRate,
      debouncedProfile.loanYears,
    );
    const shiftedTotalInterest = shiftedMonthly * months - loanTotalWan * 10000;

    const prepaySaveEstimate = Math.max(
      0,
      (prepayAmount * 10000 * commercialRate * Math.max(1, debouncedProfile.loanYears - 5)) / 2,
    );

    const droppedIncome = totalIncome * (1 - incomeDrop / 100);
    const droppedRatio = droppedIncome > 0 ? comboMonthly / droppedIncome : 1;

    return {
      totalIncome,
      totalDebt,
      conservative,
      moderate,
      aggressive,
      availableCash,
      providentCash,
      maxCash,
      recommendedPrice,
      downPaymentWan,
      loanTotalWan,
      providentLoanWan,
      commercialLoanWan,
      pureProvidentMonthly,
      pureProvidentPrincipalFirst,
      pureProvidentInterest,
      pureCommercialMonthly,
      pureCommercialPrincipalFirst,
      pureCommercialInterest,
      comboMonthly,
      comboPrincipalFirst,
      comboInterest,
      deedTax,
      vat,
      incomeTax,
      agencyFee,
      totalTax,
      renovationBudget,
      totalCashNeed,
      monthlyIncomeRatio,
      dti,
      emergencyMonths,
      leverage,
      shiftedMonthly,
      shiftedTotalInterest,
      prepaySaveEstimate,
      droppedRatio,
    };
  }, [debouncedProfile, rateShift, prepayAmount, incomeDrop]);

  function setNumber<K extends keyof FinancialProfile>(key: K, value: string) {
    const parsed = Number(value);
    setProfile((prev) => ({
      ...prev,
      [key]: Number.isNaN(parsed) ? 0 : parsed,
    }));
  }

  async function handleExportPdf() {
    if (!reportRef.current) return;
    setIsExporting(true);
    setExportFeedback(null);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
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

      pdf.save(`fasthousing-calculator-${Date.now()}.pdf`);
      setExportFeedback("导出成功：PDF 已开始下载。");
    } catch (error) {
      setExportFeedback(getExportErrorMessage(error, "PDF 导出失败，请稍后重试。"));
    } finally {
      setIsExporting(false);
    }
  }

  const quickCards = [
    {
      label: "月供收入比",
      value: `${(calculation.monthlyIncomeRatio * 100).toFixed(1)}%`,
      level: getRiskLevel(calculation.monthlyIncomeRatio, 0.3, 0.5),
      desc: "建议 ≤ 35%",
    },
    {
      label: "负债收入比 (DTI)",
      value: `${(calculation.dti * 100).toFixed(1)}%`,
      level: getRiskLevel(calculation.dti, 0.45, 0.55),
      desc: "建议 ≤ 45%",
    },
    {
      label: "应急储备",
      value: `${calculation.emergencyMonths.toFixed(1)} 个月`,
      level: calculation.emergencyMonths >= 6 ? "good" : calculation.emergencyMonths >= 3 ? "warn" : "danger",
      desc: "建议 ≥ 6个月",
    },
    {
      label: "杠杆率",
      value: `${(calculation.leverage * 100).toFixed(1)}%`,
      level: getRiskLevel(calculation.leverage, 0.6, 0.8),
      desc: "建议 ≤ 80%",
    },
  ] as const;

  return (
    <div ref={reportRef} className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">购房能力评估</h1>
        <p className="mt-2 text-sm text-slate-600">
          输入家庭财务信息，系统将基于上海政策给出可承受总价区间、贷款建议和风险提示。
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? "导出中..." : "导出 PDF 报告"}
          </button>
          {profile !== debouncedProfile ? (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">计算中...</span>
          ) : null}
        </div>
        {exportFeedback ? (
          <p
            className={`mt-2 text-xs ${
              exportFeedback.startsWith("导出成功") ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {exportFeedback}
          </p>
        ) : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">家庭财务信息</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600">
              本人月收入（元）
              <input
                type="number"
                value={profile.monthlyIncome}
                onChange={(e) => setNumber("monthlyIncome", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              配偶月收入（元）
              <input
                type="number"
                value={profile.spouseIncome}
                onChange={(e) => setNumber("spouseIncome", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              其他月收入（元）
              <input
                type="number"
                value={profile.otherIncome}
                onChange={(e) => setNumber("otherIncome", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              月固定支出（元）
              <input
                type="number"
                value={profile.monthlyExpense}
                onChange={(e) => setNumber("monthlyExpense", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              可动用存款（万）
              <input
                type="number"
                value={profile.savings}
                onChange={(e) => setNumber("savings", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              公积金余额（万）
              <input
                type="number"
                value={profile.providentBalance}
                onChange={(e) => setNumber("providentBalance", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              现有房贷月供（元）
              <input
                type="number"
                value={profile.existingMortgage}
                onChange={(e) => setNumber("existingMortgage", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              其他负债月供（元）
              <input
                type="number"
                value={profile.carLoan + profile.otherDebt}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  setProfile((prev) => ({
                    ...prev,
                    carLoan: Number.isNaN(num) ? 0 : num,
                    otherDebt: 0,
                  }));
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              目标面积（㎡）
              <input
                type="number"
                value={profile.targetArea}
                onChange={(e) => setNumber("targetArea", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              贷款年限
              <input
                type="number"
                min={5}
                max={30}
                value={profile.loanYears}
                onChange={(e) => setNumber("loanYears", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              家庭成员数
              <input
                type="number"
                min={1}
                max={10}
                value={profile.familySize}
                onChange={(e) => setNumber("familySize", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 pt-5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={profile.isFirstHome}
                onChange={(e) => setProfile((prev) => ({ ...prev, isFirstHome: e.target.checked }))}
                className="h-4 w-4 accent-[var(--brand-primary)]"
              />
              是否首套房
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">购房能力报告</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                <p className="text-emerald-700">保守型（≤30%）</p>
                <p className="mt-1 font-semibold text-emerald-800">{formatWan(calculation.conservative.totalPrice)}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-sm">
                <p className="text-blue-700">适中型（30-40%）</p>
                <p className="mt-1 font-semibold text-blue-800">{formatWan(calculation.moderate.totalPrice)}</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-3 text-sm">
                <p className="text-orange-700">激进型（40-50%）</p>
                <p className="mt-1 font-semibold text-orange-800">{formatWan(calculation.aggressive.totalPrice)}</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3 text-sm">
                <p className="text-rose-700">不建议超过</p>
                <p className="mt-1 font-semibold text-rose-800">{formatWan(calculation.aggressive.totalPrice)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">可用现金</p>
                <p className="mt-1 font-semibold text-slate-800">{formatWan(calculation.availableCash)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">可提公积金</p>
                <p className="mt-1 font-semibold text-slate-800">{formatWan(calculation.providentCash)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">首付能力总计</p>
                <p className="mt-1 font-semibold text-slate-800">{formatWan(calculation.maxCash)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">贷款方案对比（按适中型总价）</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[720px] w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="px-2 py-2 text-left font-medium">方案</th>
                    <th className="px-2 py-2 text-left font-medium">贷款额</th>
                    <th className="px-2 py-2 text-left font-medium">月供(等额本息)</th>
                    <th className="px-2 py-2 text-left font-medium">首月(等额本金)</th>
                    <th className="px-2 py-2 text-left font-medium">总利息</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-2">纯公积金</td>
                    <td className="px-2 py-2">{formatWan(calculation.providentLoanWan)}</td>
                    <td className="px-2 py-2">{formatMoney(calculation.pureProvidentMonthly)}</td>
                    <td className="px-2 py-2">{formatMoney(calculation.pureProvidentPrincipalFirst)}</td>
                    <td className="px-2 py-2">{formatMoney(calculation.pureProvidentInterest)}</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-2">纯商贷</td>
                    <td className="px-2 py-2">{formatWan(calculation.loanTotalWan)}</td>
                    <td className="px-2 py-2">{formatMoney(calculation.pureCommercialMonthly)}</td>
                    <td className="px-2 py-2">{formatMoney(calculation.pureCommercialPrincipalFirst)}</td>
                    <td className="px-2 py-2">{formatMoney(calculation.pureCommercialInterest)}</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-2">组合贷</td>
                    <td className="px-2 py-2">
                      公积金 {formatWan(calculation.providentLoanWan)} + 商贷 {formatWan(calculation.commercialLoanWan)}
                    </td>
                    <td className="px-2 py-2">{formatMoney(calculation.comboMonthly)}</td>
                    <td className="px-2 py-2">{formatMoney(calculation.comboPrincipalFirst)}</td>
                    <td className="px-2 py-2">{formatMoney(calculation.comboInterest)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">税费估算（按适中型总价）</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2 text-sm">
              <p className="rounded-lg bg-slate-50 p-2">契税：{formatMoney(calculation.deedTax)}</p>
              <p className="rounded-lg bg-slate-50 p-2">增值税：{formatMoney(calculation.vat)}</p>
              <p className="rounded-lg bg-slate-50 p-2">个税：{formatMoney(calculation.incomeTax)}</p>
              <p className="rounded-lg bg-slate-50 p-2">中介费：{formatMoney(calculation.agencyFee)}</p>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              税费合计：<span className="font-semibold">{formatMoney(calculation.totalTax)}</span>
            </p>
            <p className="text-sm text-slate-700">
              需准备现金（首付+税费+装修预备金）：<span className="font-semibold">{formatMoney(calculation.totalCashNeed)}</span>
            </p>
          </section>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
        {quickCards.map((card) => (
          <div key={card.label} className={`rounded-lg p-3 text-sm ${riskClass(card.level)}`}>
            <p>{card.label}</p>
            <p className="mt-1 text-base font-semibold">{card.value}</p>
            <p className="mt-1 text-xs opacity-80">{card.desc}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">场景模拟器</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-700">利率变动模拟（±1%）</p>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={rateShift}
              onChange={(e) => setRateShift(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-xs text-slate-600">当前调整：{rateShift.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-slate-600">月供：{formatMoney(calculation.shiftedMonthly)}</p>
            <p className="mt-1 text-xs text-slate-600">总利息：{formatMoney(calculation.shiftedTotalInterest)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-700">提前还贷模拟</p>
            <label className="mt-2 block text-xs text-slate-600">
              提前还款金额（万）
              <input
                type="number"
                value={prepayAmount}
                onChange={(e) => setPrepayAmount(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <p className="mt-2 text-xs text-slate-600">预计节省利息（粗算）：{formatMoney(calculation.prepaySaveEstimate)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-700">收入下降压力测试</p>
            <select
              value={incomeDrop}
              onChange={(e) => setIncomeDrop(Number(e.target.value))}
              className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value={20}>下降 20%</option>
              <option value={30}>下降 30%</option>
              <option value={40}>下降 40%</option>
            </select>
            <p className="mt-2 text-xs text-slate-600">
              新月供收入比：{(calculation.droppedRatio * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-700">等额本息 vs 等额本金</p>
            <p className="mt-2 text-xs text-slate-600">
              本息月供稳定：{formatMoney(calculation.comboMonthly)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              本金首月较高：{formatMoney(calculation.comboPrincipalFirst)}
            </p>
            <p className="mt-1 text-xs text-slate-600">通常等额本金总利息更低、前期压力更大。</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">财务知识卡片</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs text-slate-600">
          <p className="rounded-lg bg-slate-50 p-2">28/36 法则：住房支出建议不超过收入 28%，总负债不超过 36%。</p>
          <p className="rounded-lg bg-slate-50 p-2">买房总成本不止房价，税费、中介费、装修常见额外 10-20%。</p>
          <p className="rounded-lg bg-slate-50 p-2">建议保留至少 6 个月应急金，防范收入波动。</p>
          <p className="rounded-lg bg-slate-50 p-2">优先使用公积金贷款降低利息成本，注意额度上限。</p>
        </div>
      </section>

      <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-700">
        完成评估后建议进入房源筛选：
        <Link href="/compare" className="ml-1 font-semibold underline underline-offset-2">
          去房源对比器
        </Link>
      </p>

      <p className="text-xs leading-6 text-slate-500">
        以上计算仅供参考，不构成投资建议。实际以银行审批和最新政策为准。数据更新日期：
        {SHANGHAI_CONFIG.lastUpdated}
      </p>
    </div>
  );
}
