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
  const paymentCap = spendable * 0.4;

  const loanByPayment = inverseLoanFromPayment(paymentCap, loanRate, profile.loanYears);
  const totalByPayment = (loanByPayment / 10000) / (1 - downPaymentRate);

  const emergencyReserve = (profile.monthlyExpense * 6) / 10000;
  const availableForDown = Math.max(0, profile.savings + profile.providentBalance - emergencyReserve);
  const totalByDownPayment = availableForDown / (downPaymentRate + 0.05);

  return Math.max(0, Math.min(totalByPayment, totalByDownPayment));
}

export function calcMonthlyInvestmentIncome(remainingSavingsWan: number, annualReturnPercent: number) {
  return (remainingSavingsWan * 10000 * (annualReturnPercent / 100)) / 12;
}
