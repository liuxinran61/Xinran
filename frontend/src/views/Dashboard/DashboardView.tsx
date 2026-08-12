// ===== 保险客服 · 驾驶舱 =====
import { useState, useEffect } from "react";
import {
  Search, Sparkles, SquarePen, ChevronDown, CalendarDays,
  MessageSquareText, Clock, AlertCircle, CheckCircle2,
  TrendingUp, Flame, Shield, BrainCircuit,
} from "lucide-react";
import { getStats } from "../../api/client";
import type { SystemStats } from "../../types";
import styles from "./DashboardView.module.css";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "辛苦了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const TODAY_DATA = {
  totalInquiries: 47,
  resolved: 38,
  unresolved: 9,
  avgHandleTime: 4.2,
  peakHour: "14:00-15:00",
};

const TOP_SCENARIOS = [
  { scenario: "退款诉求", count: 12, icon: AlertCircle, color: "red", trend: "+3 vs 昨" },
  { scenario: "质问查不到扣费", count: 9, icon: Flame, color: "orange", trend: "+5 vs 昨" },
  { scenario: "解约解绑银行卡", count: 7, icon: Shield, color: "blue", trend: "持平" },
  { scenario: "投诉威胁", count: 5, icon: AlertCircle, color: "red", trend: "↓2 vs 昨" },
  { scenario: "代家人进线", count: 4, icon: MessageSquareText, color: "purple", trend: "持平" },
];

const RECENT_CASES = [
  { id: "CS20260807-001", scenario: "退款诉求", summary: "客户投保后3天要求全额退款，保单在犹豫期内", status: "已解决", time: "10:23" },
  { id: "CS20260807-002", scenario: "专业人士进线", summary: "自称律师，要求提供保单条款原文并威胁投诉银保监会", status: "升级处理", time: "11:05" },
  { id: "CS20260807-003", scenario: "关联订单", summary: "客户称在支付宝购买但查不到保单，疑似三方平台购买", status: "处理中", time: "11:42" },
  { id: "CS20260807-004", scenario: "质问查不到扣费", summary: "已扣费3个月但客户称从未收到保单，要求解释", status: "已解决", time: "13:15" },
];

export function DashboardView() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div className={styles.center}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input type="search" className={styles.searchInput} placeholder="搜索场景、话术、案例..." />
          <span className={styles.shortcut}>⌘ K</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.topAction}><Sparkles size={16} /><span>AI 助手</span></button>
          <button className={styles.iconBtn}><SquarePen size={18} /></button>
          <div className={styles.avatarBtn}>
            <span className={styles.avatar}>小</span><span>小陈</span><ChevronDown size={14} />
          </div>
        </div>
      </div>

      <div className={styles.scroll}>
        {/* Hero */}
        <div className={styles.hero}>
          <div>
            <h1>{greeting()}，小陈 👋</h1>
            <p>今日已处理 {TODAY_DATA.totalInquiries} 通会话，继续加油。</p>
          </div>
          <div className={styles.date}>
            <CalendarDays size={16} />
            <span>{new Intl.DateTimeFormat("zh-CN", { year:"numeric", month:"long", day:"numeric", weekday:"long" }).format(new Date())}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className={styles.statGrid}>
          {[
            { label: "今日进线", value: TODAY_DATA.totalInquiries, sub: "通", icon: MessageSquareText, color: "purple" },
            { label: "已解决", value: TODAY_DATA.resolved, sub: `/${TODAY_DATA.totalInquiries} 通`, icon: CheckCircle2, color: "green" },
            { label: "待处理", value: TODAY_DATA.unresolved, sub: "通", icon: AlertCircle, color: "orange", warn: TODAY_DATA.unresolved > 5 },
            { label: "平均处理时长", value: TODAY_DATA.avgHandleTime, sub: "分钟", icon: Clock, color: "blue" },
          ].map((item) => (
            <div key={item.label} className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles[`icon${item.color}`]}`}>
                <item.icon size={20} />
              </div>
              <div className={styles.statCopy}>
                <span className={styles.statLabel}>{item.label}</span>
                <strong className={item.warn ? styles.warnText : ""}>
                  {item.value}{item.sub}
                </strong>
              </div>
            </div>
          ))}
        </div>

        {/* Top Scenarios */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><Flame size={16} /> 今日高频场景</h2>
          <div className={styles.scenarioList}>
            {TOP_SCENARIOS.map((s, i) => (
              <div key={s.scenario} className={styles.scenarioRow}>
                <span className={styles.scenarioRank}>#{i + 1}</span>
                <s.icon size={16} className={s.color === "red" ? styles.redIcon : s.color === "orange" ? styles.orangeIcon : s.color === "blue" ? styles.blueIcon : styles.purpleIcon} />
                <span className={styles.scenarioName}>{s.scenario}</span>
                <span className={styles.scenarioCount}>{s.count} 通</span>
                <span className={styles.scenarioTrend}>{s.trend}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Today's Cases */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><BrainCircuit size={16} /> 今日案例</h2>
          <div className={styles.caseList}>
            {RECENT_CASES.map((c) => (
              <div key={c.id} className={styles.caseRow}>
                <span className={styles.caseId}>{c.id}</span>
                <span className={`${styles.caseTag} ${c.scenario.includes("退款") ? styles.tagRed : c.scenario.includes("专业") ? styles.tagRed : c.scenario.includes("扣费") ? styles.tagOrange : styles.tagBlue}`}>{c.scenario}</span>
                <span className={styles.caseSummary}>{c.summary}</span>
                <span className={c.status === "已解决" ? styles.statusDone : c.status === "升级处理" ? styles.statusEscalated : styles.statusPending}>{c.status}</span>
                <span className={styles.caseTime}>{c.time}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>快捷操作</h2>
          <div className={styles.actionsGrid}>
            {[
              { label: "新建会话记录", icon: SquarePen, color: "purple" },
              { label: "搜索话术", icon: Search, color: "blue" },
              { label: "查看退款流程", icon: Shield, color: "red" },
              { label: "AI 话术推荐", icon: Sparkles, color: "green" },
            ].map((a) => (
              <button key={a.label} className={styles.actionCard}>
                <div className={`${styles.actionIcon} ${styles[`icon${a.color}`]}`}><a.icon size={18} /></div>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span>场景知识: {stats?.document_count ?? 47} 条</span>
        <span className={styles.statusSep}>·</span>
        <span>话术模板: 89 条</span>
        <span className={styles.statusSep}>·</span>
        <span>高峰时段: {TODAY_DATA.peakHour}</span>
      </div>
    </div>
  );
}
