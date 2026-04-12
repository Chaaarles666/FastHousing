# FastHousing — 项目指南

## 项目概述

**FastHousing** 是一款站在买方立场的购房决策工具。
Slogan：买房不踩坑，决策有底气
目标城市：上海（首发）
形态：移动优先 H5 网页

## 技术栈

- **前端**：Next.js 14+（App Router）+ TypeScript
- **样式**：Tailwind CSS + shadcn/ui
- **图表**：Recharts
- **图标**：Lucide React
- **数据持久化**：localStorage（MVP 阶段无后端）

## 项目结构

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx            # 首页
│   ├── compare/page.tsx    # 房源对比器
│   ├── checklist/page.tsx  # 交易 Checklist
│   └── calculator/page.tsx # 购房能力评估
├── components/
│   ├── ui/                 # shadcn/ui 组件
│   ├── layout/             # Header, Footer, MobileNav
│   ├── compare/            # StarRating 等对比器组件
│   ├── checklist/
│   └── calculator/
├── lib/
│   ├── constants.ts        # 上海税率、利率等常量
│   ├── calculations.ts     # 月供、税费、策略计算函数
│   ├── storage.ts          # localStorage 封装
│   ├── export.ts           # 导出功能
│   ├── api.ts              # 后端 API 客户端（Phase 2）
│   └── types.ts            # TypeScript 类型定义
└── hooks/
    └── useLocalStorage.ts
```

## 设计规范

- **主色**：深蓝 `#1e3a5f`（CSS变量 `--brand-primary`）
- **强调色**：活力橙 `#ff6b35`（CSS变量 `--brand-accent`）
- **字体**：`-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif`
- **圆角**：卡片 8px，按钮 4px
- **间距基准**：4px 网格
- **布局**：移动端优先，桌面端自适应（375px → 1440px）
- **风格**：专业但亲和，像靠谱的朋友帮你分析

## localStorage Key 规范

| Key | 用途 |
|-----|------|
| `fasthousing_houses` | 房源对比器 — 房源列表 |
| `fasthousing_dimensions` | 房源对比器 — 权重设置 |
| `fasthousing_checklist` | 交易 Checklist 进度 |
| `fasthousing_calculator` | 购房能力评估表单数据 |

---

## 三大核心模块

### 1. 房源对比器 `/compare`

用户痛点：看了多套房脑子乱，不知道怎么取舍。

核心功能：
- 手动录入房源（最多 10 套），支持编辑删除
- 自定义评分维度和权重（总和自动归一化为 100%）
- 预设模板：学区优先 / 通勤优先 / 性价比优先 / 家庭改善型
- 对比可视化：雷达图（Recharts RadarChart）+ 排行榜 + 对比表格
- 每套房自动生成 top3 优势 + top3 劣势
- 导出为图片（html2canvas）

默认评分维度（8个）：价格(25%) / 面积(15%) / 交通(15%) / 楼层(10%) / 朝向(10%) / 学区(10%) / 小区品质(10%) / 装修(5%)

### 2. 交易 Checklist `/checklist`

用户痛点：第一次买房流程不熟，信息碎片化。

核心功能：
- 7 个阶段折叠面板（Accordion）
- 每阶段：待办 Checkbox + 避坑警示 + 材料清单 + 阶段建议 + 预计耗时
- 总体进度条 + 阶段状态追踪（未开始/进行中/已完成）
- 底部浮动条显示下一步建议
- 进度持久化到 localStorage

7 个阶段：购房准备 → 看房选房 → 谈价签约 → 贷款申请 → 过户缴税 → 交房验收 → 入住善后

### 3. 购房能力评估 `/calculator` ⚠️ 即将重构

**当前状态**：反向推算模式（输入财务 → 输出建议总价区间）

**即将重构为**：正向验证模式（详见 `docs/cursor-calculator-v2.md`）

重构后的核心变化：
- 新增**目标房价**输入 — 用户输入看中的房子价格
- **可行性判断大卡片** — 🟢买得起 / 🟡差一点 / 🔴买不起
- **三种付款策略对比** — 最低首付 / 平衡 / 多付首付，自动推荐最优
- **投资年化收益率** — 滑块0-8%，当收益>利率时推荐少付首付
- **买后生活画像** — 条形图展示收入分配（月供 / 生活开支 / 可支配）
- **满五唯一/满两年** — 精确影响税费
- 购买力区间降级为底部折叠参考信息

重构后的数据模型新增字段：
```typescript
// FinancialProfile 新增
targetPrice: number;          // 目标房价（万元）
investmentReturn: number;     // 预期投资年化收益率（%，默认3）
isFullFiveUnique: boolean;    // 满五唯一（免个税）
isOverTwoYears: boolean;      // 满两年（免增值税）
```

---

## 上海核心数据常量（`lib/constants.ts`）

```ts
// 公积金
首套利率: 3.1%  |  二套: 3.575%
个人上限: 60万  |  家庭上限: 120万

// 商贷（参考）
首套: ~3.2%  |  二套: ~3.6%

// 最低首付比例
首套: 20%  |  二套: 35%

// 契税
首套 ≤90㎡: 1%  |  首套 >90㎡: 1.5%
二套 ≤90㎡: 1%  |  二套 >90㎡: 2%
三套+: 3%

// 增值税: 不满2年 5.3%，满2年免征
// 个税: 不满五或不唯一 1%（核验价）；满五唯一免征
// 中介费: 参考 1.5%（可谈）
// 数据更新日期: 2025-04-01
```

## 计算公式

```
等额本息月供: M = P × [r(1+r)^n] / [(1+r)^n - 1]
等额本金第k月: P/n + (P - P×(k-1)/n) × r
P=贷款额, r=月利率(年利率/12), n=总月数

反推贷款额: L = M × [(1+r)^n - 1] / [r × (1+r)^n]
（已知月供反推最大可贷）
```

## 页面互跳规则

- Checklist 阶段1 → `/calculator`（评估财务）
- Checklist 阶段2 → `/compare`（使用对比器）
- Calculator 完成计算 → 提示跳转 `/compare`（去对比具体房源）

---

## 待执行的开发任务

### ⚡ 优先级1：购房能力评估重构
文件：`docs/cursor-calculator-v2.md`
说明：完整重写 calculator 页面，从"反向推算"改为"正向验证+策略优化"

### 优先级2：前端改进项
文件：`docs/cursor-improvements.md`
说明：7个独立改进（跳过改进6，已被 v2 重构覆盖）
- 改进1: 修复「不建议超过」重复值
- 改进2: 评分输入改为星星选择
- 改进3: 对比表格补全维度评分+颜色标注
- 改进4: 桌面端 Header 当前页高亮
- 改进5: 知识卡片横向滚动
- ~~改进6: 已被 calculator-v2 替代~~
- 改进7: 单价显示精度统一

### 优先级3：后端 & 数据（Phase 2）
文件：`docs/cursor-backend.md`
说明：Python FastAPI + PostgreSQL 后端、贝壳爬虫、前端API对接
- Prompt 1: 后端项目初始化
- Prompt 2: Alembic 数据库迁移
- Prompt 3: 贝壳上海爬虫
- Prompt 4: 前端对接后端API + 新增「价格透视镜」页面

### 参考文档
| 文件 | 内容 |
|------|------|
| `docs/01-market-research.md` | 市场调研、竞品分析、差异化定位 |
| `docs/02-project-plan.md` | 项目规划、里程碑、工作流程 |
| `docs/03-prd-mvp.md` | MVP 完整产品需求文档 |
| `docs/04-backend-architecture.md` | 后端架构 & 数据库设计 |
| `docs/05-crawler-strategy.md` | 爬虫策略 & 数据获取 |

---

## 开发原则

- MVP 阶段纯前端，无需后端和用户系统
- 所有计算结果页面底部加 disclaimer："以上计算仅供参考，不构成投资建议。实际以银行审批和最新政策为准。"
- 数据和政策信息标注最后更新日期
- 避免提供"投资建议"类表述，注意法律合规
- 中文界面，上海本地化
- 移动端体验优先

## 里程碑

| Phase | 时间 | 目标 |
|-------|------|------|
| Phase 1 MVP | 第1-2周 | 对比器 + Checklist + 计算器 ✅ 已完成 |
| Phase 1.5 优化 | 当前 | Calculator 重构 + 改进项 ← **你在这里** |
| Phase 2 数据 | 第3-4周 | 价格透视镜 + 数据爬虫 + 后端API |
| Phase 3 AI | 第5-8周 | AI 选房顾问 + 智能估价 + 分析报告 |
| Phase 4 商业化 | 第9-12周 | 用户系统 + 付费功能 + 内容运营 |
