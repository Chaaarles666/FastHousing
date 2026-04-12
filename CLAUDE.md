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
│   ├── compare/
│   ├── checklist/
│   └── calculator/
├── lib/
│   ├── constants.ts        # 上海税率、利率等常量
│   ├── calculations.ts     # 月供、税费计算函数
│   ├── storage.ts          # localStorage 封装
│   └── types.ts            # TypeScript 类型定义
└── hooks/
    └── useLocalStorage.ts
```

## 设计规范

- **主色**：深蓝 `#1e3a5f`
- **强调色**：活力橙 `#ff6b35`
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

## 三大核心模块

### 1. 房源对比器 `/compare`

用户痛点：看了多套房脑子乱，不知道怎么取舍。

核心功能：
- 手动录入房源（最多 10 套），支持编辑删除
- 自定义评分维度和权重（总和自动归一化为 100%）
- 预设模板：学区优先 / 通勤优先 / 性价比优先 / 家庭改善型
- 对比可视化：雷达图（Recharts RadarChart）+ 排行榜 + 对比表格
- 每套房自动生成 top3 优势 + top3 劣势

默认评分维度（8个）：价格(25%) / 面积(15%) / 交通(15%) / 楼层(10%) / 朝向(10%) / 学区(10%) / 小区品质(10%) / 装修(5%)

### 2. 交易 Checklist `/checklist`

用户痛点：第一次买房流程不熟，信息碎片化。

核心功能：
- 7 个阶段折叠面板（Accordion）
- 每阶段：待办 Checkbox + 避坑警示 + 材料清单 + 预计耗时
- 总体进度条 + 阶段状态追踪
- 进度持久化到 localStorage

7 个阶段：购房准备 → 看房选房 → 谈价签约 → 贷款申请 → 过户缴税 → 交房验收 → 入住善后

### 3. 购房能力评估 `/calculator`

用户痛点：不知道自己能买多少钱的房，月供压力有多大。

核心功能：
- 家庭财务信息表单（收入 / 负债 / 资产 / 购房条件）
- 推荐购房总价区间（保守 / 适中 / 激进 三档）
- 贷款方案对比（纯公积金 / 纯商贷 / 组合贷）
- 税费估算（契税 / 增值税 / 个税 / 中介费）
- 财务健康仪表盘（月供收入比 / DTI / 应急储备 / 杠杆率）
- 场景模拟（利率变动 / 提前还贷 / 收入变动 / 还款方式对比）
- 输入变更实时计算（debounce 300ms）

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
```

## 页面互跳规则

- Checklist 阶段1 → `/calculator`（评估财务）
- Checklist 阶段2 → `/compare`（使用对比器）
- Calculator 完成计算 → 提示跳转 `/compare`

## 开发原则

- MVP 阶段纯前端，无需后端和用户系统
- 所有计算结果页面底部加 disclaimer："以上计算仅供参考，不构成投资建议。实际以银行审批和最新政策为准。"
- 数据和政策信息标注最后更新日期
- 避免提供"投资建议"类表述，注意法律合规

## 里程碑

| Phase | 时间 | 目标 |
|-------|------|------|
| Phase 1 MVP | 第1-2周 | 对比器 + Checklist + 计算器，能用就行 |
| Phase 2 数据 | 第3-4周 | 价格透视镜 + 数据爬虫 + 小区情报 |
| Phase 3 AI | 第5-8周 | AI 选房顾问 + 智能估价 + 分析报告 |
| Phase 4 商业化 | 第9-12周 | 用户系统 + 付费功能 + 内容运营 |

## 开发文档索引

| 文件 | 内容 |
|------|------|
| `01-market-research.md` | 市场调研、竞品分析、差异化定位 |
| `02-project-plan.md` | 项目规划、里程碑、工作流程 |
| `03-prd-mvp.md` | MVP 完整产品需求文档 |
| `cursor-prompts.md` | Cursor 开发 Prompt（Prompt 0-4，按顺序执行） |
