# FastHousing — Calculator V2 新功能 Cursor Prompt

## 新功能1: 还款方式选项（等额本息 / 等额本金）

```
在购房能力评估页面的「目标房产」区域，贷款年限下方增加还款方式选择。

### types.ts 修改
FinancialProfile 新增字段：
```typescript
repaymentMethod: 'equal-installment' | 'equal-principal';  // 等额本息 | 等额本金
```

### 默认值
DEFAULT_PROFILE 新增：
```typescript
repaymentMethod: 'equal-installment',
```

### 目标房产表单新增
在贷款年限 input 下方添加：
```tsx
<div className="text-xs text-slate-600">
  <p className="mb-1.5">还款方式</p>
  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => setProfile(prev => ({ ...prev, repaymentMethod: 'equal-installment' }))}
      className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
        profile.repaymentMethod === 'equal-installment'
          ? 'border-[var(--brand-accent)] bg-orange-50 font-medium text-[var(--brand-accent)]'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      等额本息
      <span className="block text-[10px] text-slate-400 mt-0.5">月供固定</span>
    </button>
    <button
      type="button"
      onClick={() => setProfile(prev => ({ ...prev, repaymentMethod: 'equal-principal' }))}
      className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
        profile.repaymentMethod === 'equal-principal'
          ? 'border-[var(--brand-accent)] bg-orange-50 font-medium text-[var(--brand-accent)]'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      等额本金
      <span className="block text-[10px] text-slate-400 mt-0.5">总利息少</span>
    </button>
  </div>
</div>
```

### 计算逻辑修改

在 calcStrategy 函数中，根据 repaymentMethod 选择不同的月供计算方式：

```typescript
const calcStrategy = (name: string, downRaw: number): PaymentStrategy => {
  // ... 前面不变 ...
  
  let monthlyPayment: number;
  let totalInterest: number;
  
  if (debouncedProfile.repaymentMethod === 'equal-principal') {
    // 等额本金：用首月月供作为"月供"展示值（实际逐月递减）
    monthlyPayment =
      calcEqualPrincipalFirstMonthPayment(providentLoan * 10000, providentRate, debouncedProfile.loanYears) +
      calcEqualPrincipalFirstMonthPayment(commercialLoan * 10000, commercialRate, debouncedProfile.loanYears);
    
    // 等额本金总利息 = 本金 × 月利率 × (期数+1) / 2
    const providentInterest = providentLoan * 10000 * (providentRate / 12) * (months + 1) / 2;
    const commercialInterest = commercialLoan * 10000 * (commercialRate / 12) * (months + 1) / 2;
    totalInterest = (providentInterest + commercialInterest) / 10000;
  } else {
    // 等额本息：保持现有逻辑
    monthlyPayment = 
      calcEqualInstallmentMonthlyPayment(...) + calcEqualInstallmentMonthlyPayment(...);
    totalInterest = (monthlyPayment * months - loanAmount * 10000) / 10000;  // 简化
  }
  
  // ... 后面不变 ...
};
```

注意：等额本金的月供逐月递减，策略卡片中显示"首月月供"并标注"（逐月递减）"：
```tsx
<p>月供 {formatMoney(s.monthlyPayment)}
  {profile.repaymentMethod === 'equal-principal' && (
    <span className="text-slate-400">（首月，逐月递减）</span>
  )}
</p>
```

场景模拟器中的"等额本息 vs 等额本金"模块也要相应调整——显示当前选择的方式 vs 另一种方式的对比。
```

---

## 新功能2: 买后逐年家庭资产变化表

```
在购房能力评估页面的「买后生活画像」区域下方，新增一个「买后家庭资产变化」折叠表格。

### 核心逻辑

逐年计算5个维度的变化：
1. 房产价值 = 初始房价 ×（1 + 房价年涨幅）^年数
2. 剩余贷款 = 按还款方式逐年递减
3. 房产净值 = 房产价值 - 剩余贷款
4. 投资资产 = 剩余存款 × 复利增长 + 每年新增储蓄
5. 家庭总净值 = 房产净值 + 投资资产

### 新增输入

在目标房产区域底部新增一个折叠面板：
```tsx
<details className="mt-3">
  <summary className="cursor-pointer text-xs text-slate-500">📊 高级设置</summary>
  <div className="mt-2 grid gap-2">
    <label className="text-xs text-slate-600">
      预期房价年涨幅（%）
      <div className="flex items-center gap-1 mt-1">
        <input
          type="number"
          min={-5}
          max={10}
          step={0.5}
          value={profile.houseAppreciation ?? 2}
          onChange={(e) => setNumber("houseAppreciation", e.target.value)}
          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-right"
        />
        <span className="text-sm">%</span>
      </div>
    </label>
  </div>
</details>
```

types.ts 新增字段：
```typescript
houseAppreciation: number;  // 房价年涨幅%，默认2
```
DEFAULT_PROFILE 新增：`houseAppreciation: 2`

### 计算函数

在 calculations.ts 新增：

```typescript
export interface YearlyAssetRow {
  year: number;
  houseValue: number;         // 房产价值（万）
  remainingLoan: number;      // 剩余贷款（万）
  houseEquity: number;        // 房产净值（万）
  investmentAssets: number;   // 投资资产（万）
  totalNetWorth: number;      // 家庭总净值（万）
  cumulativePayment: number;  // 累计已还月供（万）
}

export function calcYearlyAssets(params: {
  housePrice: number;           // 万
  loanAmount: number;           // 万
  monthlyPayment: number;       // 元
  remainingSavings: number;     // 万
  investmentReturn: number;     // %
  houseAppreciation: number;    // %
  monthlySurplus: number;       // 月可支配（元），假设每月能存一半
  loanYears: number;
  repaymentMethod: 'equal-installment' | 'equal-principal';
  annualLoanRate: number;       // 综合贷款利率
}): YearlyAssetRow[] {
  const rows: YearlyAssetRow[] = [];
  const {
    housePrice, loanAmount, monthlyPayment, remainingSavings,
    investmentReturn, houseAppreciation, monthlySurplus, loanYears,
    repaymentMethod, annualLoanRate
  } = params;
  
  const monthlyRate = annualLoanRate / 12;
  const totalMonths = loanYears * 12;
  let currentLoan = loanAmount;  // 万
  let currentInvestment = remainingSavings;  // 万
  let cumulativePayment = 0;  // 万
  
  // 展示 1, 2, 3, 5, 10, 15, 20, 25, 30 年（或到贷款年限为止）
  const showYears = [1, 2, 3, 5, 10, 15, 20, 25, 30].filter(y => y <= loanYears);
  
  for (let year = 1; year <= loanYears; year++) {
    // 每年还12个月月供
    for (let month = 0; month < 12; month++) {
      const monthIndex = (year - 1) * 12 + month;
      if (monthIndex >= totalMonths) break;
      
      if (repaymentMethod === 'equal-installment') {
        // 等额本息：本月利息 = 剩余本金 × 月利率
        const interest = currentLoan * 10000 * monthlyRate;
        const principal = monthlyPayment - interest;
        currentLoan = Math.max(0, currentLoan - principal / 10000);
      } else {
        // 等额本金：每月还固定本金
        const monthlyPrincipal = loanAmount * 10000 / totalMonths;
        currentLoan = Math.max(0, currentLoan - monthlyPrincipal / 10000);
      }
      cumulativePayment += monthlyPayment / 10000;
    }
    
    // 投资资产增长：去年的投资 × (1+年化) + 今年新增储蓄
    const yearlyNewSaving = Math.max(0, monthlySurplus * 12 / 10000 * 0.5);  // 假设可支配收入的50%存下来
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
```

### UI 展示

在"买后生活画像"区域下方添加：

```tsx
<section className="rounded-xl border border-slate-200 bg-white p-4">
  <h2 className="text-base font-semibold text-slate-900">📊 逐年家庭资产变化</h2>
  <p className="mt-1 text-xs text-slate-500">
    假设房价年涨 {profile.houseAppreciation ?? 2}%，投资年化 {profile.investmentReturn}%，可支配收入50%用于储蓄
  </p>
  
  <div className="mt-4 overflow-x-auto">
    <table className="min-w-[700px] w-full border-collapse text-xs">
      <thead>
        <tr className="bg-slate-50 text-left text-slate-500">
          <th className="px-3 py-2 font-medium">年份</th>
          <th className="px-3 py-2 font-medium">房产价值</th>
          <th className="px-3 py-2 font-medium">剩余贷款</th>
          <th className="px-3 py-2 font-medium">房产净值</th>
          <th className="px-3 py-2 font-medium">投资资产</th>
          <th className="px-3 py-2 font-medium text-[var(--brand-primary)]">总净值</th>
          <th className="px-3 py-2 font-medium">累计已还</th>
        </tr>
      </thead>
      <tbody>
        {/* 第0行：购房时 */}
        <tr className="border-t border-slate-100 bg-slate-50/50">
          <td className="px-3 py-2">购房时</td>
          <td className="px-3 py-2">{formatWan(profile.targetPrice)}</td>
          <td className="px-3 py-2">{formatWan(calc.recommended.loanAmount)}</td>
          <td className="px-3 py-2">{formatWan(profile.targetPrice - calc.recommended.loanAmount)}</td>
          <td className="px-3 py-2">{formatWan(calc.recommended.remainingSavings)}</td>
          <td className="px-3 py-2 font-medium text-[var(--brand-primary)]">
            {formatWan(profile.targetPrice - calc.recommended.loanAmount + calc.recommended.remainingSavings)}
          </td>
          <td className="px-3 py-2">0 万</td>
        </tr>
        {yearlyAssets.map(row => (
          <tr key={row.year} className="border-t border-slate-100">
            <td className="px-3 py-2">第{row.year}年</td>
            <td className="px-3 py-2">{formatWan(row.houseValue)}</td>
            <td className="px-3 py-2">{formatWan(row.remainingLoan)}</td>
            <td className="px-3 py-2">{formatWan(row.houseEquity)}</td>
            <td className="px-3 py-2">{formatWan(row.investmentAssets)}</td>
            <td className="px-3 py-2 font-medium text-[var(--brand-primary)]">
              {formatWan(row.totalNetWorth)}
            </td>
            <td className="px-3 py-2 text-slate-400">{formatWan(row.cumulativePayment)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  
  <p className="mt-3 text-[10px] text-slate-400">
    * 房产价值基于预设年涨幅估算，实际可能有较大偏差。投资资产假设可支配收入的50%用于储蓄。仅供参考。
  </p>
</section>
```

在 calc useMemo 中调用 calcYearlyAssets：
```typescript
const yearlyAssets = calcYearlyAssets({
  housePrice: debouncedProfile.targetPrice,
  loanAmount: recommended.loanAmount,
  monthlyPayment: recommended.monthlyPayment,
  remainingSavings: recommended.remainingSavings,
  investmentReturn: debouncedProfile.investmentReturn,
  houseAppreciation: debouncedProfile.houseAppreciation ?? 2,
  monthlySurplus: disposable,
  loanYears: debouncedProfile.loanYears,
  repaymentMethod: debouncedProfile.repaymentMethod ?? 'equal-installment',
  annualLoanRate: commercialRate,  // 简化：用商贷利率近似
});
```

展示年份：第1、2、3、5、10、15、20、25、30年（不超过贷款年限）。
移动端表格横向滚动。
```
