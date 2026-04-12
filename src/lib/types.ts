export interface HouseItem {
  id: string;
  name: string;
  totalPrice: number;
  area: number;
  unitPrice: number;
  layout: string;
  floor: string;
  floorScore: number;
  orientation: string;
  orientationScore: number;
  buildYear?: number;
  decoration: string;
  metroDistance?: number;
  commuteTime?: number;
  transportScore: number;
  school: string;
  schoolScore: number;
  communityScore: number;
  decorationScore: number;
  propertyFee?: number;
  notes?: string;
  createdAt: number;
}

export interface ScoreDimension {
  key: string;
  label: string;
  weight: number;
  autoCalc: boolean;
}

export interface FinancialProfile {
  monthlyIncome: number;
  spouseIncome: number;
  otherIncome: number;
  monthlyExpense: number;
  savings: number;
  providentBalance: number;
  providentMonthly: number;
  investmentReturn: number;
  existingMortgage: number;
  carLoan: number;
  otherDebt: number;
  targetPrice: number;
  isFirstHome: boolean;
  isFullFiveUnique: boolean;
  isOverTwoYears: boolean;
  familySize: number;
  targetArea: number;
  loanYears: number;
  repaymentMethod: "equal-installment" | "equal-principal";
  houseAppreciation: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  subItems?: string[];
}

export interface ChecklistPhase {
  id: string;
  title: string;
  icon: string;
  estimatedDays: string;
  items: ChecklistItem[];
  pitfalls: string[];
  documents: string[];
  tips: string[];
}
