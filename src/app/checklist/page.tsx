"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { STORAGE_KEYS } from "@/lib/constants";
import { ChecklistPhase } from "@/lib/types";

const CHECKLIST_PHASES: ChecklistPhase[] = [
  {
    id: "prep",
    title: "购房准备",
    icon: "🏁",
    estimatedDays: "1-2周",
    items: [
      { id: "prep-1", text: "确认购房资格（上海限购政策自查）" },
      { id: "prep-2", text: "拉取个人征信报告" },
      { id: "prep-3", text: "查询公积金账户余额和月缴存额" },
      { id: "prep-4", text: "评估家庭财务状况" },
      { id: "prep-5", text: "确定预算范围和目标区域" },
      { id: "prep-6", text: "列出核心需求（必须有 / 最好有）" },
    ],
    pitfalls: [
      "社保/个税断缴可能影响购房资格，提前确认。",
      "征信有逾期会影响贷款，至少提前半年处理。",
      "贷款申请前避免新增大额负债。",
    ],
    documents: ["身份证", "户口本", "婚姻证明", "社保/个税证明", "征信报告", "公积金缴存证明"],
    tips: ["先完成购房能力评估，再定预算区间。"],
  },
  {
    id: "viewing",
    title: "看房选房",
    icon: "🔍",
    estimatedDays: "2-8周",
    items: [
      { id: "viewing-1", text: "制定看房路线和计划" },
      { id: "viewing-2", text: "实地看房 15-30 套" },
      { id: "viewing-3", text: "记录每套房关键数据（价格、面积、噪音、通勤）" },
      { id: "viewing-4", text: "同一房源不同时段复看（白天/晚上/周末）" },
      { id: "viewing-5", text: "与保安或业主交流居住体验" },
      { id: "viewing-6", text: "核实物业费、停车费和小区规划" },
    ],
    pitfalls: [
      "不要只看装修和样板间，重点看真实问题。",
      "“满五唯一”直接影响税费，务必核验。",
      "地铁步行时间建议自己实测。",
    ],
    documents: ["手机拍照录像", "看房笔记", "卷尺", "指南针 App"],
    tips: ["使用房源对比器统一记录，避免信息碎片化。"],
  },
  {
    id: "signing",
    title: "谈价签约",
    icon: "💰",
    estimatedDays: "1-2周",
    items: [
      { id: "signing-1", text: "查询同小区近 3-6 个月成交价" },
      { id: "signing-2", text: "制定议价策略并准备备选方案" },
      { id: "signing-3", text: "核验产权状态（抵押/查封/共有权）" },
      { id: "signing-4", text: "确认租约和优先购买权状态" },
      { id: "signing-5", text: "审阅合同关键条款和违约责任" },
      { id: "signing-6", text: "支付定金并保留银行凭证" },
    ],
    pitfalls: [
      "“定金”和“订金”法律后果不同，合同措辞要核对。",
      "合同中要写明贷款失败退出条款。",
      "避免阴阳合同，规避法律和税务风险。",
    ],
    documents: ["购房合同", "身份证", "产权证明材料", "定金凭证"],
    tips: ["金额较大时建议找专业人士复核合同。"],
  },
  {
    id: "loan",
    title: "贷款申请",
    icon: "🏦",
    estimatedDays: "2-4周",
    items: [
      { id: "loan-1", text: "确定贷款方案（商贷 / 公积金 / 组合）" },
      { id: "loan-2", text: "对比至少 3 家银行利率和放款速度" },
      { id: "loan-3", text: "选择还款方式（等额本息 / 等额本金）" },
      { id: "loan-4", text: "准备收入证明与 6 个月流水" },
      { id: "loan-5", text: "提交申请并跟进审批进度" },
    ],
    pitfalls: [
      "审批前 3-6 个月不要频繁新增信用申请。",
      "组合贷通常要求同一家银行办理商贷部分。",
      "预留 Plan B，防止贷款额度不及预期。",
    ],
    documents: ["收入证明", "银行流水", "征信报告", "购房合同", "婚姻证明"],
    tips: ["审批周期可能波动，和卖方提前约定时间缓冲。"],
  },
  {
    id: "transfer",
    title: "过户缴税",
    icon: "📝",
    estimatedDays: "1-2周",
    items: [
      { id: "transfer-1", text: "确认税费承担方与金额口径" },
      { id: "transfer-2", text: "到交易中心办理过户" },
      { id: "transfer-3", text: "缴纳契税、增值税、个税" },
      { id: "transfer-4", text: "领取新不动产权证" },
      { id: "transfer-5", text: "确认卖方户口迁出" },
    ],
    pitfalls: [
      "税费常按核验价计算，可能与成交价不同。",
      "过户前再核验房屋有无新增抵押或查封。",
      "证件信息领取时当场核对。",
    ],
    documents: ["双方身份证", "不动产权证", "完税证明", "贷款合同"],
    tips: ["先核对材料清单，可减少往返。"],
  },
  {
    id: "handover",
    title: "交房验收",
    icon: "🔑",
    estimatedDays: "1-3天",
    items: [
      { id: "handover-1", text: "按清单检查水电燃气、门窗、墙面、下水" },
      { id: "handover-2", text: "核验房屋面积与附属设施" },
      { id: "handover-3", text: "抄表并拍照留档" },
      { id: "handover-4", text: "确认卖方结清各项费用" },
      { id: "handover-5", text: "收齐全部钥匙与门禁卡" },
    ],
    pitfalls: [
      "验房建议在尾款支付前完成。",
      "核实物业欠费，避免后续交割纠纷。",
      "留存照片和视频，便于后续维权。",
    ],
    documents: ["验房工具", "抄表记录", "交接清单", "费用结清证明"],
    tips: ["可邀请有经验的亲友一起验房。"],
  },
  {
    id: "movein",
    title: "入住善后",
    icon: "🎉",
    estimatedDays: "持续",
    items: [
      { id: "movein-1", text: "办理物业交接和门禁权限" },
      { id: "movein-2", text: "更换门锁并更新家庭应急信息" },
      { id: "movein-3", text: "办理水电燃气网络过户" },
      { id: "movein-4", text: "按需办理户口迁入/加名" },
      { id: "movein-5", text: "整理购房档案并长期保存" },
    ],
    pitfalls: [
      "换锁建议入住第一天完成。",
      "装修前先确认小区装修规则。",
      "购房资料建议至少保存到贷款结清。",
    ],
    documents: ["不动产权证", "身份证", "户口本", "物业交接单"],
    tips: ["加入业主群，及时获取小区通知。"],
  },
];

const defaultChecklistState = CHECKLIST_PHASES.reduce<Record<string, boolean>>((acc, phase) => {
  phase.items.forEach((item) => {
    acc[item.id] = false;
  });
  return acc;
}, {});

function getPhaseStatus(completed: number, total: number) {
  if (completed === 0) return "未开始";
  if (completed >= total) return "已完成";
  return "进行中";
}

export default function ChecklistPage() {
  const [checkedMap, setCheckedMap] = useLocalStorage<Record<string, boolean>>(
    STORAGE_KEYS.checklist,
    defaultChecklistState,
  );
  const [openPhaseId, setOpenPhaseId] = useState<string | null>(null);

  const phaseStats = useMemo(
    () =>
      CHECKLIST_PHASES.map((phase) => {
        const completed = phase.items.filter((item) => checkedMap[item.id]).length;
        const total = phase.items.length;
        const status = getPhaseStatus(completed, total);

        return {
          ...phase,
          completed,
          total,
          status,
          progress: total === 0 ? 0 : Math.round((completed / total) * 100),
        };
      }),
    [checkedMap],
  );

  const totalItems = phaseStats.reduce((sum, phase) => sum + phase.total, 0);
  const completedItems = phaseStats.reduce((sum, phase) => sum + phase.completed, 0);
  const overallProgress = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  const currentPhase =
    phaseStats.find((phase) => phase.status === "进行中") ??
    phaseStats.find((phase) => phase.status === "未开始") ??
    phaseStats[phaseStats.length - 1];

  const nextAction =
    currentPhase?.items.find((item) => !checkedMap[item.id])?.text ?? "当前阶段事项已完成，可进入下一阶段。";

  function toggleItem(itemId: string) {
    setCheckedMap((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  }

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">交易 Checklist</h1>
        <p className="mt-2 text-sm text-slate-600">按 7 个阶段推进买房流程，关键事项勾选后会自动保存。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>总体进度</span>
          <span>
            {completedItems}/{totalItems}（{overallProgress}%）
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </section>

      <section className="space-y-3">
        {phaseStats.map((phase, index) => {
          const expanded = openPhaseId ? openPhaseId === phase.id : phase.id === currentPhase?.id;

          return (
            <article key={phase.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenPhaseId((prev) => (prev === phase.id ? null : phase.id))}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    阶段 {index + 1}：{phase.title} {phase.icon}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    预计耗时：{phase.estimatedDays} · 完成度 {phase.completed}/{phase.total}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    phase.status === "已完成"
                      ? "bg-emerald-100 text-emerald-700"
                      : phase.status === "进行中"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {phase.status}
                </span>
              </button>

              {expanded ? (
                <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                  <ul className="space-y-2">
                    {phase.items.map((item) => {
                      const checked = Boolean(checkedMap[item.id]);

                      return (
                        <li key={item.id}>
                          <label
                            className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 transition-all duration-200 ${
                              checked ? "bg-emerald-50 text-emerald-800" : "hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItem(item.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[var(--brand-primary)]"
                            />
                            <span className={`text-sm ${checked ? "line-through opacity-80" : "text-slate-700"}`}>
                              {item.text}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="rounded-lg bg-orange-50 p-3">
                    <p className="text-xs font-semibold text-orange-700">⚠️ 避坑提示</p>
                    <ul className="mt-2 space-y-1 text-xs text-orange-800">
                      {phase.pitfalls.map((pitfall) => (
                        <li key={pitfall}>- {pitfall}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">📋 材料清单</p>
                    <p className="mt-2 text-xs text-slate-600">{phase.documents.join("、")}</p>
                  </div>

                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-semibold text-blue-700">💡 阶段建议</p>
                    <ul className="mt-2 space-y-1 text-xs text-blue-800">
                      {phase.tips.map((tip) => (
                        <li key={tip}>- {tip}</li>
                      ))}
                    </ul>

                    {phase.id === "prep" ? (
                      <p className="mt-2 text-xs text-blue-800">
                        推荐动作：
                        <Link href="/calculator" className="ml-1 font-semibold underline underline-offset-2">
                          去购房能力评估
                        </Link>
                      </p>
                    ) : null}

                    {phase.id === "viewing" ? (
                      <p className="mt-2 text-xs text-blue-800">
                        推荐动作：
                        <Link href="/compare" className="ml-1 font-semibold underline underline-offset-2">
                          去房源对比器
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <aside className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-xs md:text-sm">
          <div className="min-w-0">
            <p className="text-slate-500">下一步建议（{currentPhase?.title}）</p>
            <p className="truncate font-medium text-slate-800">{nextAction}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{overallProgress}%</span>
        </div>
      </aside>
    </div>
  );
}
