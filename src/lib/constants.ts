import { ScoreDimension } from "./types";

export const STORAGE_KEYS = {
  houses: "fasthousing_houses",
  dimensions: "fasthousing_dimensions",
  checklist: "fasthousing_checklist",
  calculator: "fasthousing_calculator",
} as const;

export const SHANGHAI_CONFIG = {
  provident: {
    rateFirst: 0.031,
    rateSecond: 0.03575,
    maxSingle: 60,
    maxFamily: 120,
  },
  commercial: {
    rateFirst: 0.032,
    rateSecond: 0.036,
  },
  downPayment: {
    first: 0.2,
    second: 0.35,
  },
  tax: {
    deed: {
      firstSmall: 0.01,
      firstLarge: 0.015,
      secondSmall: 0.01,
      secondLarge: 0.02,
      third: 0.03,
    },
    vat: 0.053,
    incomeTax: 0.01,
    agencyFee: 0.015,
  },
  lastUpdated: "2025-04-01",
} as const;

export const DEFAULT_DIMENSIONS: ScoreDimension[] = [
  { key: "price", label: "价格", weight: 25, autoCalc: true },
  { key: "area", label: "面积", weight: 15, autoCalc: true },
  { key: "transport", label: "交通", weight: 15, autoCalc: false },
  { key: "floor", label: "楼层", weight: 10, autoCalc: false },
  { key: "orientation", label: "朝向", weight: 10, autoCalc: false },
  { key: "school", label: "学区", weight: 10, autoCalc: false },
  { key: "community", label: "小区品质", weight: 10, autoCalc: false },
  { key: "decoration", label: "装修", weight: 5, autoCalc: false },
];
