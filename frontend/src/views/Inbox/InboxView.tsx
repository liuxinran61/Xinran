// ===== 保险客服 · 会话记录录入 =====
import { useState } from "react";
import {
  Search, Plus, ChevronDown, MessageSquareText,
  Clock, Tag, Star, Trash2, Archive, Filter,
  AlertCircle, Flame, Shield, UserCheck, CreditCard,
  ShoppingCart, Unlink, HelpCircle, ExternalLink,
} from "lucide-react";
import styles from "./InboxView.module.css";

// 11 insurance CS scenarios
const SCENARIOS = [
  { id: "refund", label: "退款诉求", icon: AlertCircle, color: "red", severity: "high" },
  { id: "complaint", label: "投诉威胁", icon: Flame, color: "red", severity: "critical" },
  { id: "professional", label: "专业人士", icon: UserCheck, color: "orange", severity: "high" },
  { id: "family", label: "代家人进线", icon: UserCheck, color: "purple", severity: "medium" },
  { id: "order", label: "关联订单", icon: ShoppingCart, color: "blue", severity: "medium" },
  { id: "thirdparty", label: "三方平台", icon: ExternalLink, color: "orange", severity: "high" },
  { id: "other_company", label: "非我司公司", icon: HelpCircle, color: "blue", severity: "medium" },
  { id: "payment", label: "支付渠道", icon: CreditCard, color: "green", severity: "medium" },
  { id: "unbind", label: "解约解绑银行卡", icon: Unlink, color: "purple", severity: "high" },
  { id: "ask_insurer", label: "多次主动询问保司", icon: Shield, color: "orange", severity: "high" },
  { id: "charge_dispute", label: "质问查不到扣费", icon: Flame, color: "red", severity: "critical" },
];

const SENTIMENTS = [
  { id: "calm", label: "平静", color: "green" },
  { id: "anxious", label: "焦虑", color: "orange" },
  { id: "angry", label: "愤怒", color: "red" },
  { id: "urgent", label: "紧急", color: "red" },
];

const DEMO_SESSIONS = [
  { id: "1", scenario: "退款诉求", sentiment: "anxious", customer: "张女士", orderNo: "POL-2026-0812", summary: "投保后3天要求退保，称在犹豫期内", tags: ["犹豫期", "全额退款"], time: "10:23", resolved: true },
  { id: "2", scenario: "专业人士进线", sentiment: "angry", customer: "李先生", orderNo: "", summary: "自称律师，威胁投诉银保监会，要求提供合同原文", tags: ["律师", "监管投诉"], time: "11:05", resolved: false },
  { id: "3", scenario: "质问查不到扣费", sentiment: "urgent", customer: "王先生", orderNo: "PAY-2026-0701", summary: "连续3个月扣费但未收到保单，情绪激动", tags: ["扣费争议", "3月未到账"], time: "11:42", resolved: false },
  { id: "4", scenario: "解约解绑银行卡", sentiment: "calm", customer: "赵女士", orderNo: "POL-2025-1120", summary: "保单到期想解绑自动续费银行卡", tags: ["自动续费", "到期解约"], time: "14:10", resolved: true },
];

export function InboxView() {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSession, setNewSession] = useState({ scenario: "", sentiment: "", customer: "", orderNo: "", summary: "" });

  const handleSaveSession = () => {
    setNewSession({ scenario: "", sentiment: "", customer: "", orderNo: "", summary: "" });
    setShowNewSession(false);
  };

  const filtered = DEMO_SESSIONS.filter((s) => {
    if (filter === "unresolved") return !s.resolved;
    if (filter === "resolved") return s.resolved;
    if (filter === "critical") return ["投诉威胁", "质问查不到扣费"].includes(s.scenario);
    return true;
  }).filter((s) => {
    if (!query) return true;
    return `${s.scenario} ${s.customer} ${s.summary}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className={styles.center}>
      <div className={styles.topbar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input type="search" className={styles.searchInput} placeholder="搜索会话、客户、场景..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className={styles.shortcut}>⌘ K</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.actionBtn} onClick={() => setShowNewSession(true)}>
            <Plus size={16} /> <span>新建会话记录</span>
          </button>
          <div className={styles.avatarBtn}><span className={styles.avatar}>小</span><span>小陈</span><ChevronDown size={14} /></div>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.header}><h1>会话记录</h1><p>快速录入客户会话场景，积累处理经验。</p></div>

        {/* Quick scenario buttons */}
        <div className={styles.scenarioBar}>
          <span className={styles.scenarioBarLabel}>快速录入场景:</span>
          {SCENARIOS.slice(0, 8).map((sc) => (
            <button key={sc.id} className={`${styles.scenarioChip} ${styles[`sev${sc.severity}`]}`} onClick={() => { setNewSession({ scenario: sc.label, sentiment: "", customer: "", orderNo: "", summary: "" }); setShowNewSession(true); }}>
              <sc.icon size={12} /> {sc.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[
            ["all", "全部", DEMO_SESSIONS.length],
            ["unresolved", "待处理", DEMO_SESSIONS.filter((s) => !s.resolved).length],
            ["critical", "高风险", DEMO_SESSIONS.filter((s) => ["投诉威胁", "质问查不到扣费"].includes(s.scenario)).length],
            ["resolved", "已解决", DEMO_SESSIONS.filter((s) => s.resolved).length],
          ].map(([id, label, count]) => (
            <button key={id} className={`${styles.tab} ${filter === id ? styles.tabActive : ""}`} onClick={() => setFilter(id as string)}>
              <Filter size={14} /> {label} <b>{count as number}</b>
            </button>
          ))}
        </div>

        {/* Session cards */}
        <div className={styles.sessionList}>
          {filtered.map((s) => (
            <div key={s.id} className={styles.sessionCard}>
              <div className={styles.sessionHeader}>
                <span className={`${styles.sessionScenario} ${s.scenario.includes("退款") || s.scenario.includes("投诉") || s.scenario.includes("扣费") ? styles.scenarioRed : s.scenario.includes("律师") || s.scenario.includes("保司") ? styles.scenarioOrange : styles.scenarioBlue}`}>
                  {s.scenario}
                </span>
                <span className={`${styles.sentiment} ${styles[`sent${s.sentiment}`]}`}>
                  {SENTIMENTS.find((se) => se.id === s.sentiment)?.label}
                </span>
                {!s.resolved && <span className={styles.unresolvedBadge}>待处理</span>}
              </div>
              <div className={styles.sessionBody}>
                <div className={styles.sessionMeta}>
                  <span>👤 {s.customer}</span>
                  {s.orderNo && <span>📋 {s.orderNo}</span>}
                  <span><Clock size={12} /> {s.time}</span>
                </div>
                <p>{s.summary}</p>
              </div>
              <div className={styles.sessionTags}>
                {s.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
              </div>
              <div className={styles.sessionActions}>
                <button><Star size={14} /></button>
                <button><Archive size={14} /></button>
                <button><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Session Modal */}
      {showNewSession && (
        <div className={styles.overlay} onClick={() => setShowNewSession(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>新建会话记录</h2>
            <div className={styles.formGrid}>
              <label>场景分类
                <select value={newSession.scenario} onChange={(e) => setNewSession((s) => ({ ...s, scenario: e.target.value }))}>
                  <option value="">选择场景...</option>
                  {SCENARIOS.map((sc) => <option key={sc.id} value={sc.label}>{sc.label}</option>)}
                </select>
              </label>
              <label>客户情绪
                <select value={newSession.sentiment} onChange={(e) => setNewSession((s) => ({ ...s, sentiment: e.target.value }))}>
                  <option value="">选择情绪...</option>
                  {SENTIMENTS.map((se) => <option key={se.id} value={se.id}>{se.label}</option>)}
                </select>
              </label>
              <label>客户姓名 <input type="text" value={newSession.customer} onChange={(e) => setNewSession((s) => ({ ...s, customer: e.target.value }))} placeholder="张女士" /></label>
              <label>订单/保单号 <input type="text" value={newSession.orderNo} onChange={(e) => setNewSession((s) => ({ ...s, orderNo: e.target.value }))} placeholder="POL-2026-XXXX" /></label>
            </div>
            <label className={styles.summaryLabel}>会话摘要
              <textarea rows={3} value={newSession.summary} onChange={(e) => setNewSession((s) => ({ ...s, summary: e.target.value }))} placeholder="简要记录客户诉求和处理过程..." />
            </label>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowNewSession(false)}>取消</button>
              <button className={styles.primaryBtn} onClick={handleSaveSession}>保存记录</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span>今日录入: {DEMO_SESSIONS.length} 条</span>
        <span className={styles.statusSep}>·</span>
        <span>待处理: {DEMO_SESSIONS.filter((s) => !s.resolved).length}</span>
      </div>
    </div>
  );
}
