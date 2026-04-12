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
