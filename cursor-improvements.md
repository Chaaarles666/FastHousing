# FastHousing MVP 改进项 — Cursor Prompt

## 使用说明
以下 7 个改进项独立执行，按优先级排列。每个直接复制给 Cursor。

**⚡ 优先执行改进6**（首付约束+结果突出），这是最影响用户体验的。

---

## 改进1: 修复「不建议超过」与激进型重复

```
在 /calculator 页面中，「不建议超过」卡片目前显示的金额和「激进型」一样，这是一个 bug。

修复方案：
1. 在 calculation 中新增一个 `ceiling` 档位，用月供占收入 60% 来计算（即 calcRangeByRatio(0.6)）
2. 「不建议超过」显示 ceiling.totalPrice
3. 或者更简单：直接去掉「不建议超过」这张卡片，改为在激进型卡片下方加一行小字警告："⛔ 月供超过收入50%风险极高，强烈不建议"

选择方案2更简洁。修改 calculator/page.tsx 中的对应区域即可。
```

---

## 改进2: 评分输入改为星星/按钮选择

```
在房源对比器的添加/编辑表单中，当前的1-5评分使用 number input，手机端体验不好。

改为可点击的星星评分组件：

1. 新建组件 src/components/compare/star-rating.tsx：

interface StarRatingProps {
  value: number;          // 1-5
  onChange: (v: number) => void;
  label: string;
}

- 渲染5个星星（用 Lucide 的 Star 图标）
- 点击第 N 个星星设置评分为 N
- 已选的星星用 fill 填充（橙色 var(--brand-accent)），未选的用 stroke 描边（灰色）
- 星星大小 24px，间距 4px
- 下方显示文字说明：1=很差 2=较差 3=一般 4=较好 5=优秀

2. 在 compare/page.tsx 中，将所有评分相关的 <input type="number"> 替换为 <StarRating>

涉及的评分字段：floorScore, orientationScore, transportScore, schoolScore, communityScore, decorationScore
```

---

## 改进3: 对比表格补全维度评分

```
在房源对比器的对比表格中，目前只显示了基本信息（总价、面积、户型等），缺少各维度评分。

修改 compare/page.tsx 中的对比表格 tbody 数组，在现有行之后追加：

{ label: "楼层评分", getValue: (house) => house.floorScore.toFixed(1) },
{ label: "朝向评分", getValue: (house) => house.orientationScore.toFixed(1) },
{ label: "交通评分", getValue: (house) => house.transportScore.toFixed(1) },
{ label: "学区评分", getValue: (house) => house.schoolScore.toFixed(1) },
{ label: "小区品质", getValue: (house) => house.communityScore.toFixed(1) },
{ label: "装修评分", getValue: (house) => house.decorationScore.toFixed(1) },

同时在评分行的单元格中加颜色标注：
- 4-5 分：绿色文字
- 3 分：灰色
- 1-2 分：红色文字

这样用户一眼就能看出哪套房在哪个维度弱。
```

---

## 改进4: 桌面端 Header 添加当前页高亮

```
在 src/components/layout/header.tsx 中：

1. 将组件改为 "use client"
2. 引入 usePathname from "next/navigation"
3. 给当前激活的导航项添加高亮样式：

const pathname = usePathname();
const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

高亮样式：
- 激活：bg-slate-100 text-[var(--brand-primary)] font-medium
- 未激活：text-slate-600 hover:bg-slate-100 hover:text-slate-900（保持现有）
```

---

## 改进5: 知识卡片横向滚动

```
在 calculator/page.tsx 的财务知识卡片区域，将 grid 布局改为横向滚动：

<div className="mt-3 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
  {cards.map(card => (
    <div key={card} className="min-w-[240px] flex-shrink-0 snap-center rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
      {card}
    </div>
  ))}
</div>

这样在手机端可以左右滑动浏览，每张卡片 snap 对齐。

额外：给卡片加上 emoji 前缀让内容更醒目：
- 📏 28/36 法则...
- 💸 买房总成本不止房价...
- 🛟 建议保留至少6个月应急金...
- 🏦 优先使用公积金贷款...
```

---

## 改进6: 购房能力评估 — 首付约束 + 结果突出显示（重要）

```
购房能力评估页面 (/calculator) 有两个关键问题需要修复：

### 问题1: 可动用存款没有参与总价计算

当前逻辑只用"月供承受力"反推总价，但实际买房有两个硬约束：
- 约束A：月供不能超过收入的 X%（现有逻辑）
- 约束B：首付必须付得起（现在完全没有！）

两个约束取较小值，才是真正的可承受总价。

修改 calculation useMemo 中的逻辑：

```typescript
// 现有：只按月供反推
const conservative = calcRangeByRatio(0.3);

// 修改为：同时考虑首付约束
function calcAffordablePrice(paymentRatio: number) {
  // 约束A：按月供承受力反推
  const paymentCap = spendable * paymentRatio;
  const loanByPayment = inverseLoanFromPayment(paymentCap, commercialRate, profile.loanYears);
  const totalByPayment = (loanByPayment / 10000) / (1 - downPaymentRate);

  // 约束B：按首付能力反推
  // 可用首付 = 存款 + 可提取公积金
  // 但要预留：税费(约总价3-5%) + 中介费(1.5%) + 装修预备金 + 至少6个月应急金
  const emergencyReserve = profile.monthlyExpense * 6 / 10000; // 万元
  const availableForDown = Math.max(0, 
    profile.savings + profile.providentBalance - emergencyReserve
  );
  // 首付 = 总价 × 首付比例，所以 总价 = 可用首付 / 首付比例
  // 但还要扣掉税费等，简化为：可用首付 / (首付比例 + 0.05)
  const totalByDownPayment = availableForDown / (downPaymentRate + 0.05);

  // 取两个约束的较小值
  const totalPrice = Math.min(totalByPayment, totalByPayment);
  const limitedBy = totalByDownPayment < totalByPayment ? 'downpayment' : 'payment';

  return { paymentCap, totalPrice, totalByPayment, totalByDownPayment, limitedBy };
}

const conservative = calcAffordablePrice(0.3);
const moderate = calcAffordablePrice(0.4);
const aggressive = calcAffordablePrice(0.5);
```

每个档位卡片下面加一行小字标注是被什么约束的：
- 如果 limitedBy === 'downpayment'：显示 "⚠️ 受首付能力限制"（橙色）
- 如果 limitedBy === 'payment'：显示 "受月供承受力限制"（灰色）

### 问题2: 建议总价不够突出，用户找不到

当前"推荐购房总价区间"藏在报告区域里，和一堆其他数据混在一起。

修改方案：

1. 在表单上方（或移动端的表单和结果之间）添加一个醒目的"核心结论"卡片：

```tsx
{/* 核心结论 — 最显眼的位置 */}
<section className="rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-slate-700 p-5 text-white shadow-lg">
  <p className="text-xs tracking-wider text-slate-300">你的建议购房总价</p>
  <p className="mt-2 text-4xl font-bold">
    {formatWan(conservative.totalPrice)} ~ {formatWan(moderate.totalPrice)}
  </p>
  <p className="mt-1 text-sm text-slate-200">
    保守 {formatWan(conservative.totalPrice)} · 适中 {formatWan(moderate.totalPrice)} · 激进 {formatWan(aggressive.totalPrice)}
  </p>
  <div className="mt-3 flex gap-2">
    <span className="rounded-full bg-white/20 px-2 py-1 text-xs">
      首付约 {formatWan(moderate.totalPrice * downPaymentRate)}
    </span>
    <span className="rounded-full bg-white/20 px-2 py-1 text-xs">
      月供约 {formatMoney(moderate.paymentCap)}
    </span>
  </div>
  {moderate.limitedBy === 'downpayment' && (
    <p className="mt-2 text-xs text-orange-300">
      ⚠️ 当前受首付能力限制，增加存款可提升购买力
    </p>
  )}
</section>
```

2. 这个卡片放在页面最顶部（标题下方、表单上方），用户一进来就能看到默认值算出的结果
3. 修改表单数据后，这个卡片实时更新
4. 保留下方原有的详细报告区域，作为展开的细节分析

### 总结：修改要点

1. calcAffordablePrice 函数：同时考虑月供+首付两个约束，取较小值
2. 新增"核心结论"大卡片：放在页面最上方（表单之前），大字号显示建议总价
3. 每个档位标注是被什么约束的
4. 当首付是瓶颈时，给出明确提示

这样用户打开页面第一眼就能看到"我大概能买多少钱的房"，而不是要翻半天才找到。
```

---

## 改进7: 单价显示精度统一

```
全局检查单价的显示格式，统一为：

- 总价：保留1位小数（如 450.0 万）
- 单价：保留2位小数（如 5.83 万/㎡）
- 月供：取整，千分位分隔（如 ¥12,345）
- 评分：保留1位小数（如 3.5）

目前大部分已经符合，检查一下 compare 页面的房源卡片和表格中有没有不一致的地方。
```
