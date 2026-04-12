# FastHousing — Calculator V2 修复 Cursor Prompt

## 背景
购房能力评估页面已重构为正向验证模式，但有 6 个体验问题需要修复。

---

## 修复内容（一次性执行）

```
修改 src/app/calculator/page.tsx 和 src/lib/calculations.ts，修复以下 6 个问题：

### 修复1: "30年总成本"改为"30年总利息"

当前策略对比卡片中显示"30年总成本"，计算方式是 房价+税费+总利息-投资总收益。这个概念太复杂，用户看不懂，而且可能出现负数或小于房价的反直觉结果。

修改：
- 策略卡片中删除"30年总成本"这一行
- 改为只显示"30年总利息"（totalInterest），这是用户真正关心的
- PaymentStrategy interface 中可以保留 totalCost 字段但不展示

修改位置：策略对比卡片的 JSX 部分
```tsx
// 改前
<p>总利息 {formatWan(s.totalInterest)} · 30年总成本 {formatWan(s.totalCost)}</p>
// 改后
<p>30年总利息 {formatWan(s.totalInterest)}</p>
```

### 修复2: 年化收益率改为输入框+滑块联动

当前年化收益率只有一个 range 滑块，不方便精确输入。

修改：改为左侧数字输入框 + 右侧滑块联动。改任何一个，另一个跟着变。

```tsx
// 把原来的年化收益率 label 替换为：
<label className="text-xs text-slate-600">
  <div className="flex items-center gap-2">
    <span>年化收益率</span>
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={8}
        step={0.1}
        value={profile.investmentReturn}
        onChange={(e) => setNumber("investmentReturn", e.target.value)}
        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-right"
      />
      <span className="text-sm">%</span>
    </div>
  </div>
  <input
    type="range"
    min={0}
    max={8}
    step={0.5}
    value={profile.investmentReturn}
    onChange={(e) => setNumber("investmentReturn", e.target.value)}
    className="mt-2 w-full"
  />
  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
    <span>0% 活期</span>
    <span>3% 理财</span>
    <span>5% 基金</span>
    <span>8% 股市</span>
  </div>
</label>
```

### 修复3: 利率变动滑块显示具体数值和变化量

当前利率变动滑块只显示调整后的月供，用户不知道当前调整了多少、利率变成了多少、月供变化了多少。

修改场景模拟器中的利率变动区域：

```tsx
<div className="rounded-lg bg-slate-50 p-3 text-sm">
  <p className="font-medium text-slate-700">利率变动模拟</p>
  <input
    type="range"
    min={-1}
    max={1}
    step={0.1}
    value={rateShift}
    onChange={(e) => setRateShift(Number(e.target.value))}
    className="mt-2 w-full"
  />
  <div className="mt-2 space-y-1 text-xs text-slate-600">
    <p>
      调整幅度：
      <span className={rateShift > 0 ? 'text-rose-600 font-medium' : rateShift < 0 ? 'text-emerald-600 font-medium' : ''}>
        {rateShift > 0 ? '+' : ''}{rateShift.toFixed(1)}%
      </span>
    </p>
    <p>
      商贷利率：{(calc.commercialRate * 100).toFixed(2)}% → {((calc.commercialRate + rateShift / 100) * 100).toFixed(2)}%
    </p>
    <p>
      月供变化：{formatMoney(calc.recommended.monthlyPayment)} → {formatMoney(calc.shiftedMonthly)}
      <span className={calc.shiftedMonthly > calc.recommended.monthlyPayment ? ' text-rose-600' : ' text-emerald-600'}>
        （{calc.shiftedMonthly > calc.recommended.monthlyPayment ? '+' : ''}{formatMoney(calc.shiftedMonthly - calc.recommended.monthlyPayment)}/月）
      </span>
    </p>
  </div>
</div>
```

### 修复4: 收入下降压力测试显示负数结余

当前 droppedDisposable 在代码中已经可以是负数，但 formatMoney 函数里有 Math.max(0, ...)，会把负数截为0。

修改1：修改 formatMoney 函数，允许负数：
```tsx
function formatMoney(value: number) {
  const abs = Math.abs(Math.round(value));
  const formatted = abs.toLocaleString("zh-CN");
  if (value < 0) return `-¥${formatted}`;
  return `¥${formatted}`;
}
```

修改2：压力测试区域增加更丰富的展示：
```tsx
<div className="rounded-lg bg-slate-50 p-3 text-sm">
  <p className="font-medium text-slate-700">收入下降压力测试</p>
  <select
    value={incomeDrop}
    onChange={(e) => setIncomeDrop(Number(e.target.value))}
    className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
  >
    <option value={10}>下降 10%</option>
    <option value={20}>下降 20%</option>
    <option value={30}>下降 30%</option>
    <option value={40}>下降 40%</option>
    <option value={50}>下降 50%</option>
  </select>
  <div className="mt-2 space-y-1 text-xs text-slate-600">
    <p>下降后月收入：{formatMoney(totalIncome * (1 - incomeDrop / 100))}</p>
    <p className={calc.droppedDisposable < 0 ? 'text-rose-600 font-medium' : 'text-emerald-600'}>
      下降后月结余：{formatMoney(calc.droppedDisposable)}
      {calc.droppedDisposable < 0 && ' ❌ 入不敷出！'}
    </p>
    {calc.droppedDisposable < 0 && calc.recommended.remainingSavings > 0 && (
      <p className="text-rose-600">
        每月缺口 {formatMoney(Math.abs(calc.droppedDisposable))}，
        剩余存款可支撑约 {Math.floor(calc.recommended.remainingSavings * 10000 / Math.abs(calc.droppedDisposable))} 个月
      </p>
    )}
  </div>
</div>
```

注意：需要把 totalIncome 传入或在模板中重新计算。在 calc 的 return 中添加 totalIncome：
```typescript
// calc useMemo return 中添加：
totalIncome,
```

### 修复5: 购买力区间逻辑修正

当前 calcMaxPurchasePower 函数取的是 min(按月供算, 按首付算)，但对于存款很多的人，应该还要考虑全款购买的能力。

修改 src/lib/calculations.ts 中的 calcMaxPurchasePower：

```typescript
export function calcMaxPurchasePower(profile: FinancialProfile) {
  const downPaymentRate = profile.isFirstHome 
    ? SHANGHAI_CONFIG.downPayment.first 
    : SHANGHAI_CONFIG.downPayment.second;
  const loanRate = profile.isFirstHome 
    ? SHANGHAI_CONFIG.commercial.rateFirst 
    : SHANGHAI_CONFIG.commercial.rateSecond;
  const totalIncome = profile.monthlyIncome + profile.spouseIncome + profile.otherIncome;
  const totalDebt = profile.existingMortgage + profile.carLoan + profile.otherDebt;
  const spendable = Math.max(0, totalIncome - profile.monthlyExpense - totalDebt);
  const paymentCap = spendable * 0.5; // 用激进比例50%算上限

  const loanByPayment = inverseLoanFromPayment(paymentCap, loanRate, profile.loanYears);
  
  const emergencyReserve = (profile.monthlyExpense * 6) / 10000;
  const availableCash = Math.max(0, profile.savings + profile.providentBalance - emergencyReserve);
  
  // 方式1：贷款购买（首付+贷款）
  const totalByLoan = availableCash / (downPaymentRate + 0.05) + loanByPayment / 10000;
  // 但不能超过：首付能力/首付比例（即最大首付能撬动的总价）
  const maxByDownPayment = availableCash / downPaymentRate;
  const totalByLoanCapped = Math.min(totalByLoan, maxByDownPayment);
  
  // 方式2：全款购买（不贷款）
  const totalByCash = availableCash;
  
  // 取两者较大值（有钱人可以全款买更贵的房）
  return Math.max(0, Math.max(totalByLoanCapped, totalByCash));
}
```

这样存款 2000 万的人，购买力上限会正确显示为 2000 万+，而不是被月供约束到 500 万。

### 修复6: 可行性卡片中"购买力上限"文案优化

当前显示"购买力上限约 578.1 万"，用户不理解这是什么意思。

修改可行性大卡片中的文案：

```tsx
// 改前
<p className="mt-1 text-sm opacity-90">
  目标总价 {formatWan(profile.targetPrice)} · 购买力上限约 {formatWan(calc.maxPurchasePower)}
</p>

// 改后
<p className="mt-1 text-sm opacity-90">
  目标总价 {formatWan(profile.targetPrice)}
</p>
<p className="text-xs opacity-75">
  按你的收入和存款，最高可承受约 {formatWan(calc.maxPurchasePower)} 的房产
  {profile.targetPrice <= calc.maxPurchasePower 
    ? '，目标在范围内 ✅' 
    : '，目标已超出 ⚠️'}
</p>
```

这样用户就能明白：这个数字是根据他的财务状况算出来的天花板，而不是一个莫名其妙的数字。

---

## 额外优化：formatWan 也允许负数

和 formatMoney 同理：
```tsx
function formatWan(value: number) {
  if (value < 0) return `-${Math.abs(value).toFixed(1)} 万`;
  return `${value.toFixed(1)} 万`;
}
```
```
