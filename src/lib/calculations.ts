import { SHANGHAI_CONFIG } from "./constants";
import { FinancialProfile } from "./types";

export function calcEqualInstallmentMonthlyPayment(
  principal: number,
  annualRate: number,
  years: number,
) {
  const monthlyRate = annualRate / 12;
  const months = years * 12;

  if (principal <= 0 || monthlyRate <= 0 || months <= 0) return 0;

  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function calcEqualPrincipalFirstMonthPayment(
  principal: number,
  annualRate: number,
  years: number,
) {
  const monthlyRate = annualRate / 12;
  const months = years * 12;

  if (principal <= 0 || monthlyRate <= 0 || months <= 0) return 0;

  return principal / months + principal * monthlyRate;
}

export function inverseLoanFromPayment(monthlyPayment: number, annualRate: number, years: number) {
  const monthlyRate = annualRate / 12;
  const months = years * 12;

  if (monthlyPayment <= 0 || months <= 0) return 0;
  if (monthlyRate <= 0) return monthlyPayment * months;

  const factor = Math.pow(1 + monthlyRate, months);
  return (monthlyPayment * (factor - 1)) / (monthlyRate * factor);
}

export function calcTaxes(profile: FinancialProfile) {
  const priceYuan = profile.targetPrice * 10000;

  let deedRate: number;
  if (profile.isFirstHome) {
    deedRate = profile.targetArea <= 90 ? SHANGHAI_CONFIG.tax.deed.firstSmall : SHANGHAI_CONFIG.tax.deed.firstLarge;
  } else {
    deedRate = profile.targetArea <= 90 ? SHANGHAI_CONFIG.tax.deed.secondSmall : SHANGHAI_CONFIG.tax.deed.secondLarge;
  }

  const deedTax = priceYuan * deedRate;
  const vat = profile.isOverTwoYears ? 0 : priceYuan * SHANGHAI_CONFIG.tax.vat;
  const incomeTax = profile.isFullFiveUnique ? 0 : priceYuan * SHANGHAI_CONFIG.tax.incomeTax;
  const agencyFee = priceYuan * SHANGHAI_CONFIG.tax.agencyFee;
  const total = (deedTax + vat + incomeTax + agencyFee) / 10000;

  return {
    deedTax,
    vat,
    incomeTax,
    agencyFee,
    total,
  };
}

export function calcMaxPurchasePower(profile: FinancialProfile) {
  const downPaymentRate = profile.isFirstHome ? SHANGHAI_CONFIG.downPayment.first : SHANGHAI_CONFIG.downPayment.second;
  const loanRate = profile.isFirstHome ? SHANGHAI_CONFIG.commercial.rateFirst : SHANGHAI_CONFIG.commercial.rateSecond;
  const totalIncome = profile.monthlyIncome + profile.spouseIncome + profile.otherIncome;
  const totalDebt = profile.existingMortgage + profile.carLoan + profile.otherDebt;
  const spendable = Math.max(0, totalIncome - profile.monthlyExpense - totalDebt);
  const paymentCap = spendable * 0.5;

  const loanByPayment = inverseLoanFromPayment(paymentCap, loanRate, profile.loanYears);
  const emergencyReserve = (profile.monthlyExpense * 6) / 10000;
  const availableCash = Math.max(0, profile.savings + profile.providentBalance - emergencyReserve);

  const totalByLoan = availableCash / (downPaymentRate + 0.05) + loanByPayment / 10000;
  const maxByDownPayment = availableCash / downPaymentRate;
  const totalByLoanCapped = Math.min(totalByLoan, maxByDownPayment);
  const totalByCash = availableCash;

  return Math.max(0, Math.max(totalByLoanCapped, totalByCash));
}

export function calcMonthlyInvestmentIncome(remainingSavingsWan: number, annualReturnPercent: number) {
  return (remainingSavingsWan * 10000 * (annualReturnPercent / 100)) / 12;
}

export interface YearlyAssetRow {
  year: number;
  houseValue: number;
  remainingLoan: number;
  houseEquity: number;
  investmentAssets: number;
  totalNetWorth: number;
  cumulativePayment: number;
}

export function calcYearlyAssets(params: {
  housePrice: number;
  loanAmount: number;
  monthlyPayment: number;
  remainingSavings: number;
  investmentReturn: number;
  houseAppreciation: number;
  monthlySurplus: number;
  loanYears: number;
  repaymentMethod: "equal-installment" | "equal-principal";
  annualLoanRate: number;
}): YearlyAssetRow[] {
  const rows: YearlyAssetRow[] = [];
  const {
    housePrice,
    loanAmount,
    monthlyPayment,
    remainingSavings,
    investmentReturn,
    houseAppreciation,
    monthlySurplus,
    loanYears,
    repaymentMethod,
    annualLoanRate,
  } = params;

  const monthlyRate = annualLoanRate / 12;
  const totalMonths = loanYears * 12;
  let currentLoan = Math.max(0, loanAmount);
  let currentInvestment = Math.max(0, remainingSavings);
  let cumulativePayment = 0;

  const showYears = [1, 2, 3, 5, 10, 15, 20, 25, 30].filter((year) => year <= loanYears);

  for (let year = 1; year <= loanYears; year++) {
    for (let month = 0; month < 12; month++) {
      const monthIndex = (year - 1) * 12 + month;
      if (monthIndex >= totalMonths || currentLoan <= 0) break;

      if (repaymentMethod === "equal-installment") {
        const interest = currentLoan * 10000 * monthlyRate;
        const principal = Math.max(0, monthlyPayment - interest);
        const principalWan = Math.min(currentLoan, principal / 10000);
        currentLoan = Math.max(0, currentLoan - principalWan);
        cumulativePayment += monthlyPayment / 10000;
      } else {
        const monthlyPrincipal = (loanAmount * 10000) / totalMonths;
        const principalWan = Math.min(currentLoan, monthlyPrincipal / 10000);
        const interest = currentLoan * 10000 * monthlyRate;
        currentLoan = Math.max(0, currentLoan - principalWan);
        cumulativePayment += (principalWan * 10000 + interest) / 10000;
      }
    }

    const yearlyNewSaving = Math.max(0, ((monthlySurplus * 12) / 10000) * 0.5);
    currentInvestment = currentInvestment * (1 + investmentReturn / 100) + yearlyNewSaving;

    if (showYears.includes(year)) {
      const houseValue = housePrice * Math.pow(1 + houseAppreciation / 100, year);
      const houseEquity = houseValue - currentLoan;
      rows.push({
        year,
        houseValue,
        remainingLoan: currentLoan,
        houseEquity,
        investmentAssets: currentInvestment,
        totalNetWorth: houseEquity + currentInvestment,
        cumulativePayment,
      });
    }
  }

  return rows;
}
