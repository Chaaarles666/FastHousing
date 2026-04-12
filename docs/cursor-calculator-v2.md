# FastHousing — 购房能力评估重构 Cursor Prompt

## 背景

当前购房能力评估页面的逻辑是"反向推算建议总价"，但实际用户心里已经有目标价了。需要重构为"正向验证 + 付款策略优化"模式。

核心变化：
- 旧：输入财务信息 → 输出"你该买多少钱的房"
- 新：输入财务信息 + 目标房价 → 输出"买得起吗 + 怎么买最划算 + 买后生活画像"

---

## 完整 Prompt

```
重构 FastHousing 的购房能力评估页面 (/calculator)。这是一个大改动，需要重写整个页面逻辑和布局。

## 新的数据模型

interface FinancialProfile {
  // === 家庭财务 ===
  monthlyIncome: number;        // 本人月收入（税后，元）
  spouseIncome: number;         // 配偶月收入（税后，元）
  otherIncome: number;          // 其他月收入（元）
  monthlyExpense: number;       // 月固定生活支出（元）
  
  // === 资产 ===
  savings: number;              // 可动用存款（万元）
  providentBalance: number;     // 公积金账户余额（万元）
  providentMonthly: number;     // 公积金月缴存额（个人+单位，元）
  investmentReturn: number;     // 预期投资年化收益率（%，默认3）
  
  // === 负债 ===
  existingMortgage: number;     // 现有房贷月供（元）
  carLoan: number;              // 车贷月供（元）
  otherDebt: number;            // 其他贷款月供（元）
  
  // === 目标房产（新增！核心变化） ===
  targetPrice: number;          // 目标房价（万元）
  targetArea: number;           // 目标面积（㎡）
  isFirstHome: boolean;         // 是否首套
  isFullFiveUnique: boolean;    // 是否满五唯一（影响税费）
  isOverTwoYears: boolean;      // 是否满两年（影响增值税）
  
  // === 贷款偏好 ===
  loanYears: number;            // 贷款年限（默认30年）
  familySize: number;           // 家庭成员数
}

## 上海参数（constants.ts 不变，新增投资收益默认值）

在 SHANGHAI_CONFIG 中新增：
```typescript
defaults: {
  investmentReturn: 3,  // 默认年化3%
}
```

## 核心计算逻辑（重写 calculations.ts）

### 1. 可行性判断

```typescript
function assessAffordability(profile: FinancialProfile) {
  const downPaymentRate = profile.isFirstHome ? 0.20 : 0.35;
  const requiredDownPayment = profile.targetPrice * downPaymentRate;  // 万元
  
  // 税费计算
  const taxes = calcTaxes(profile);  // 返回万元
  
  // 最低需要的现金 = 首付 + 税费
  const minCashNeeded = requiredDownPayment + taxes.total;
  
  // 可用现金 = 存款 + 可提取公积金
  const availableCash = profile.savings + profile.providentBalance;
  
  // 判断买不买得起
  const canAfford = availableCash >= minCashNeeded;
  const cashGap = minCashNeeded - availableCash;  // 正数=差多少，负数=还富余
  
  // 购买力上限（辅助参考）
  const maxPurchasePower = calcMaxPurchasePower(profile);
  
  return { canAfford, cashGap, minCashNeeded, availableCash, maxPurchasePower };
}
```

### 2. 三种付款策略

```typescript
interface PaymentStrategy {
  name: string;
  downPayment: number;        // 首付（万元）
  loanAmount: number;         // 贷款总额（万元）
  providentLoan: number;      // 公积金贷款部分
  commercialLoan: number;     // 商贷部分
  monthlyPayment: number;     // 月供（元）
  remainingSavings: number;   // 剩余存款（万元）
  investmentIncome: number;   // 月投资收益（元）
  netMonthlyCost: number;     // 净月支出 = 月供 - 投资收益（元）
  totalInterest: number;      // 30年总利息（万元）
  totalCost: number;          // 总成本 = 房价 + 利息 - 投资总收益（万元）
  recommended: boolean;       // 是否推荐
  reason: string;             // 推荐理由
}

function calcStrategies(profile: FinancialProfile): PaymentStrategy[] {
  const downPaymentRate = profile.isFirstHome ? 0.20 : 0.35;
  const taxes = calcTaxes(profile);
  const availableCash = profile.savings + profile.providentBalance;
  const loanRate = profile.isFirstHome 
    ? SHANGHAI_CONFIG.commercial.rateFirst 
    : SHANGHAI_CONFIG.commercial.rateSecond;
  const investRate = profile.investmentReturn / 100;
  
  // 策略A：最低首付（保留最多投资本金）
  const strategyA = calcSingleStrategy({
    name: "最低首付型",
    downPayment: profile.targetPrice * downPaymentRate,
    ...共用参数
  });
  
  // 策略B：平衡型（首付约50%）
  const balanceDown = Math.min(
    profile.targetPrice * 0.5,
    availableCash - taxes.total - (profile.monthlyExpense * 12 / 10000)  // 留12个月应急金
  );
  const strategyB = calcSingleStrategy({
    name: "平衡型",
    downPayment: Math.max(profile.targetPrice * downPaymentRate, balanceDown),
    ...共用参数
  });
  
  // 策略C：多付首付型（最小化贷款）
  const maxDown = Math.min(
    profile.targetPrice * 0.8,  // 最多付80%首付
    availableCash - taxes.total - (profile.monthlyExpense * 6 / 10000)  // 至少留6个月应急金
  );
  const strategyC = calcSingleStrategy({
    name: "多付首付型",
    downPayment: Math.max(profile.targetPrice * downPaymentRate, maxDown),
    ...共用参数
  });
  
  // 判断哪个策略最优
  // 规则：如果投资年化 > 贷款利率 → 推荐最低首付
  //       如果投资年化 < 贷款利率 → 推荐多付首付
  //       如果差不多 → 推荐平衡型
  if (investRate > loanRate + 0.005) {
    strategyA.recommended = true;
    strategyA.reason = "投资回报高于贷款利率，少付首付更划算";
  } else if (investRate < loanRate - 0.005) {
    strategyC.recommended = true;
    strategyC.reason = "贷款利率高于投资回报，多付首付减少利息";
  } else {
    strategyB.recommended = true;
    strategyB.reason = "利率接近，平衡风险与收益";
  }
  
  return [strategyA, strategyB, strategyC];
}
```

### 3. 买后生活画像

```typescript
interface LifeAfterPurchase {
  monthlyIncome: number;         // 月收入
  monthlyPayment: number;        // 月供
  monthlyExpense: number;        // 生活开支
  monthlyInvestIncome: number;   // 投资收益
  disposableIncome: number;      // 每月可支配 = 收入 + 投资收益 - 月供 - 开支
  paymentToIncomeRatio: number;  // 月供收入比
  dti: number;                   // 负债收入比
  emergencyMonths: number;       // 应急储备月数
  incomeDropThreshold: number;   // 收入下降多少%会撑不住（月供=全部剩余收入）
}
```

### 4. 税费计算（精确版）

```typescript
function calcTaxes(profile: FinancialProfile) {
  const price = profile.targetPrice * 10000;  // 转为元
  
  // 契税
  let deedRate: number;
  if (profile.isFirstHome) {
    deedRate = profile.targetArea <= 90 ? 0.01 : 0.015;
  } else {
    deedRate = profile.targetArea <= 90 ? 0.01 : 0.02;
  }
  const deedTax = price * deedRate;
  
  // 增值税（满两年免）
  const vat = profile.isOverTwoYears ? 0 : price * 0.053;
  
  // 个人所得税（满五唯一免）
  const incomeTax = profile.isFullFiveUnique ? 0 : price * 0.01;
  
  // 中介费
  const agencyFee = price * 0.015;
  
  const total = (deedTax + vat + incomeTax + agencyFee) / 10000;  // 转回万元
  
  return { deedTax, vat, incomeTax, agencyFee, total };
}
```

## 页面布局（完全重写 calculator/page.tsx）

### 整体结构

```
页面从上到下：

1. 标题 + 说明
2. 输入区域（两栏）
   左栏：家庭财务信息
   右栏：目标房产信息
3. ⭐ 可行性结论大卡片（最醒目）
4. 三种付款策略对比表
5. 买后生活画像
6. 税费明细
7. 场景模拟器（利率变动、收入下降、提前还贷）
8. 购买力参考区间（辅助信息，折叠）
9. 财务知识卡片
10. Disclaimer
```

### 3. 可行性结论大卡片（核心焦点）

```tsx
<section className="rounded-2xl p-6 text-white shadow-lg"
  style={{
    background: canAfford 
      ? 'linear-gradient(135deg, #059669, #047857)'   // 绿色：买得起
      : cashGap < targetPrice * 0.1 
        ? 'linear-gradient(135deg, #d97706, #b45309)' // 橙色：差一点
        : 'linear-gradient(135deg, #dc2626, #b91c1c)' // 红色：买不起
  }}
>
  <div className="flex items-center gap-2">
    <span className="text-3xl">{canAfford ? '🟢' : cashGap < targetPrice * 0.1 ? '🟡' : '🔴'}</span>
    <div>
      <p className="text-lg font-bold">
        {canAfford 
          ? `这套房你买得起` 
          : `还差 ${formatWan(cashGap)} 万`
        }
      </p>
      <p className="text-sm opacity-90">
        目标总价 {targetPrice} 万 · 你的购买力上限约 {formatWan(maxPurchasePower)} 万
      </p>
    </div>
  </div>
  
  {canAfford && (
    <div className="mt-4 flex gap-3">
      <div className="rounded-lg bg-white/20 px-3 py-2 text-sm">
        最低首付 {formatWan(minDownPayment)} 万
      </div>
      <div className="rounded-lg bg-white/20 px-3 py-2 text-sm">
        推荐月供 {formatMoney(recommendedStrategy.monthlyPayment)}
      </div>
      <div className="rounded-lg bg-white/20 px-3 py-2 text-sm">
        需准备现金 {formatWan(minCashNeeded)} 万
      </div>
    </div>
  )}
  
  {!canAfford && (
    <div className="mt-3 text-sm opacity-90">
      <p>最低需要现金：{formatWan(minCashNeeded)} 万（首付 {formatWan(minDownPayment)} + 税费 {formatWan(taxes.total)}）</p>
      <p>你的可用资金：{formatWan(availableCash)} 万</p>
      <p className="mt-2 font-medium">💡 建议：降低目标价到 {formatWan(affordablePrice)} 万以内，或增加存款 {formatWan(cashGap)} 万</p>
    </div>
  )}
</section>
```

### 4. 付款策略对比表

```tsx
{/* 只在买得起时显示 */}
<section className="rounded-xl border border-slate-200 bg-white p-4">
  <h2 className="text-base font-semibold text-slate-900">付款策略对比</h2>
  <p className="mt-1 text-xs text-slate-500">
    基于你的投资预期年化 {profile.investmentReturn}% vs 贷款利率 {(loanRate * 100).toFixed(1)}%
  </p>
  
  <div className="mt-4 grid gap-3 md:grid-cols-3">
    {strategies.map(strategy => (
      <div key={strategy.name} 
        className={`rounded-xl border-2 p-4 ${
          strategy.recommended 
            ? 'border-[var(--brand-accent)] bg-orange-50' 
            : 'border-slate-200 bg-white'
        }`}
      >
        {strategy.recommended && (
          <span className="rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-xs font-medium text-white">
            ⭐ 推荐
          </span>
        )}
        <h3 className="mt-2 text-sm font-semibold">{strategy.name}</h3>
        
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">首付</span>
            <span className="font-medium">{formatWan(strategy.downPayment)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">贷款</span>
            <span>{formatWan(strategy.loanAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">月供</span>
            <span>{formatMoney(strategy.monthlyPayment)}</span>
          </div>
          <hr />
          <div className="flex justify-between">
            <span className="text-slate-500">剩余投资</span>
            <span>{formatWan(strategy.remainingSavings)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">月投资收益</span>
            <span className="text-emerald-600">+{formatMoney(strategy.investmentIncome)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>净月支出</span>
            <span className={strategy.netMonthlyCost <= 0 ? 'text-emerald-600' : ''}>
              {strategy.netMonthlyCost <= 0 ? '净赚 ' : ''}{formatMoney(Math.abs(strategy.netMonthlyCost))}
            </span>
          </div>
          <hr />
          <div className="flex justify-between text-xs text-slate-500">
            <span>30年总成本</span>
            <span>{formatWan(strategy.totalCost)}</span>
          </div>
        </div>
        
        {strategy.recommended && (
          <p className="mt-3 text-xs text-orange-700">{strategy.reason}</p>
        )}
      </div>
    ))}
  </div>
</section>
```

### 5. 买后生活画像

```tsx
<section className="rounded-xl border border-slate-200 bg-white p-4">
  <h2 className="text-base font-semibold text-slate-900">买房后的月度财务画像</h2>
  <p className="mt-1 text-xs text-slate-500">基于推荐策略计算</p>
  
  {/* 条形图可视化：收入的分配 */}
  <div className="mt-4">
    {/* 一个水平堆叠条形图 */}
    {/* 月供占比 | 生活开支占比 | 可支配占比 */}
    <div className="flex h-8 overflow-hidden rounded-full text-xs text-white">
      <div style={{width: `${paymentRatio}%`}} className="flex items-center justify-center bg-blue-500">
        月供 {paymentRatio.toFixed(0)}%
      </div>
      <div style={{width: `${expenseRatio}%`}} className="flex items-center justify-center bg-slate-400">
        开支 {expenseRatio.toFixed(0)}%
      </div>
      <div style={{width: `${disposableRatio}%`}} className="flex items-center justify-center bg-emerald-500">
        可支配 {disposableRatio.toFixed(0)}%
      </div>
    </div>
    
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="text-slate-500">月收入（含投资）</p>
        <p className="font-semibold">{formatMoney(totalIncome + investIncome)}</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="text-slate-500">月供</p>
        <p className="font-semibold">{formatMoney(monthlyPayment)}</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="text-slate-500">生活开支</p>
        <p className="font-semibold">{formatMoney(monthlyExpense)}</p>
      </div>
      <div className="rounded-lg bg-emerald-50 p-3 text-sm">
        <p className="text-emerald-700">每月可支配</p>
        <p className="font-semibold text-emerald-800">{formatMoney(disposable)}</p>
      </div>
    </div>
  </div>
  
  {/* 风险指标 */}
  <div className="mt-4 grid gap-3 md:grid-cols-4">
    {/* 复用之前的4个健康指标卡片 */}
    {/* 月供收入比、DTI、应急储备、收入下降阈值 */}
  </div>
  
  {/* 收入下降阈值提醒 */}
  <p className="mt-3 text-xs text-slate-500">
    ⚠️ 如果收入下降 {incomeDropThreshold.toFixed(0)}% 以上，月供将超过剩余收入。
    当前每月有 {formatMoney(disposable)} 缓冲空间。
  </p>
</section>
```

### 右栏：目标房产信息表单

```tsx
<div className="rounded-xl border-2 border-dashed border-[var(--brand-accent)] bg-orange-50/50 p-4">
  <h2 className="text-base font-semibold text-slate-900">🏠 目标房产</h2>
  <p className="mt-1 text-xs text-slate-500">输入你看中的房子信息</p>
  
  <div className="mt-3 grid gap-3">
    {/* 目标房价 — 最大最醒目的输入框 */}
    <label className="text-sm font-medium text-slate-700">
      目标总价（万元）
      <input
        type="number"
        value={profile.targetPrice}
        onChange={...}
        placeholder="例如 800"
        className="mt-1 w-full rounded-lg border-2 border-[var(--brand-accent)] px-4 py-3 text-2xl font-bold text-slate-900"
      />
    </label>
    
    <label className="text-xs text-slate-600">
      目标面积（㎡）
      <input type="number" value={profile.targetArea} ... className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
    </label>
    
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={profile.isFirstHome} ... />
        首套房
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={profile.isFullFiveUnique} ... />
        满五唯一（免个税）
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={profile.isOverTwoYears} ... />
        满两年（免增值税）
      </label>
    </div>
    
    {/* 投资收益率滑块 */}
    <label className="text-xs text-slate-600">
      存款预期年化收益率：{profile.investmentReturn}%
      <input type="range" min={0} max={8} step={0.5} value={profile.investmentReturn} ... className="mt-1 w-full" />
      <div className="flex justify-between text-xs text-slate-400">
        <span>0%（活期）</span>
        <span>4%（理财）</span>
        <span>8%（股市）</span>
      </div>
    </label>
  </div>
</div>
```

### 8. 购买力参考区间（折叠，辅助信息）

```tsx
<details className="rounded-xl border border-slate-200 bg-white">
  <summary className="cursor-pointer p-4 text-sm font-semibold text-slate-700">
    💡 参考：你的购买力区间
  </summary>
  <div className="border-t border-slate-100 p-4">
    <div className="grid gap-2 md:grid-cols-3 text-sm">
      <div className="rounded-lg bg-emerald-50 p-3">
        <p className="text-emerald-700">保守（月供≤30%）</p>
        <p className="font-semibold text-emerald-800">{formatWan(conservative)}</p>
      </div>
      <div className="rounded-lg bg-blue-50 p-3">
        <p className="text-blue-700">适中（月供≤40%）</p>
        <p className="font-semibold text-blue-800">{formatWan(moderate)}</p>
      </div>
      <div className="rounded-lg bg-orange-50 p-3">
        <p className="text-orange-700">激进（月供≤50%）</p>
        <p className="font-semibold text-orange-800">{formatWan(aggressive)}</p>
      </div>
    </div>
    <p className="mt-2 text-xs text-slate-500">
      以上区间同时考虑了月供承受力和首付能力，取两者较低值。
    </p>
  </div>
</details>
```

## 默认值更新

```typescript
const DEFAULT_PROFILE: FinancialProfile = {
  monthlyIncome: 30000,
  spouseIncome: 20000,
  otherIncome: 0,
  monthlyExpense: 12000,
  savings: 120,           // 万
  providentBalance: 30,   // 万
  providentMonthly: 8000,
  investmentReturn: 3,    // 新增：年化3%
  existingMortgage: 0,
  carLoan: 0,
  otherDebt: 0,
  targetPrice: 500,       // 新增：目标500万
  targetArea: 90,
  isFirstHome: true,
  isFullFiveUnique: false, // 新增
  isOverTwoYears: true,   // 新增
  loanYears: 30,
  familySize: 2,
};
```

## types.ts 更新

更新 FinancialProfile interface，新增：
- targetPrice: number
- investmentReturn: number
- isFullFiveUnique: boolean
- isOverTwoYears: boolean

## 场景模拟器保留

保留现有的场景模拟器（利率变动、收入下降、提前还贷、等额本息vs本金），但改为基于推荐策略的数据来计算，而不是之前的"适中型总价"。

## 导出功能保留

PDF 导出功能保留，导出新的完整报告。

## 移动端适配

- 表单两栏在移动端变为上下排列
- 策略对比三卡片在移动端变为纵向排列
- 生活画像的条形图在移动端保持横向（足够窄）
- 可行性大卡片全宽

## 重要：删除旧的改进6

之前 cursor-improvements.md 中的"改进6: 首付约束 + 结果突出显示"不需要再单独执行了，因为本次重构已经完全覆盖了那个改进的所有内容。
```
