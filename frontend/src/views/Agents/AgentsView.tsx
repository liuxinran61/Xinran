// ===== AI Knowledge OS Web — AI Agents View =====
import { useState } from "react";
import {
  Search, Sparkles, ChevronDown, Plus,
  Bot, Newspaper, PanelTop, GraduationCap, Target,
  BriefcaseBusiness, Play, Clock, CheckCircle2, XCircle,
  Loader2, ArrowRight,
} from "lucide-react";
import styles from "./AgentsView.module.css";

const AGENTS = [
  { id: "content", name: "内容运营 Agent", icon: Newspaper, color: "purple", desc: "从知识库生成文章、提案与内容草稿，并保留来源。", trigger: "按需运行", output: "文章 / 脚本", category: "内容" },
  { id: "business", name: "商业分析 Agent", icon: PanelTop, color: "blue", desc: "分析客户资料、业务场景、采购阻力与企业落地路径。", trigger: "手动触发", output: "分析报告", category: "商业" },
  { id: "learning", name: "学习研究 Agent", icon: GraduationCap, color: "teal", desc: "总结论文与课程，提炼概念、证据、反例和适用边界。", trigger: "手动触发", output: "学习卡片", category: "学习" },
  { id: "customer", name: "客户调研 Agent", icon: Target, color: "orange", desc: "整理访谈与反馈，生成客户画像、洞察和追踪问题。", trigger: "按需运行", output: "调研洞察", category: "商业" },
  { id: "project", name: "项目助理 Agent", icon: BriefcaseBusiness, color: "blue", desc: "跟踪里程碑和任务，生成项目周报并识别交付风险。", trigger: "项目更新后", output: "周报 / 风险", category: "项目" },
  { id: "organizer", name: "知识库整理 Agent", icon: Bot, color: "purple", desc: "清理、归类、去重并为知识建立标签和双向链接。", trigger: "按需运行", output: "知识卡片", category: "知识" },
];

const DEMO_EXECUTIONS = [
  { id: "e1", agent: "内容运营 Agent", status: "done", input: "生成本周AI技术文章", output: "已生成3篇草稿", created: "2小时前" },
  { id: "e2", agent: "项目助理 Agent", status: "running", input: "分析项目进度", output: "", created: "5分钟前" },
  { id: "e3", agent: "知识库整理 Agent", status: "done", input: "去重和标记标签", output: "标记了42篇文档", created: "昨天" },
];

export function AgentsView() {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].id);
  const [showRun, setShowRun] = useState(false);
  const [runInput, setRunInput] = useState("");

  const agent = AGENTS.find((a) => a.id === selectedAgent) || AGENTS[0];

  const handleRun = () => {
    setRunInput("");
    setShowRun(false);
  };

  return (
    <div className={styles.center}>
      <div className={styles.topbar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input type="search" className={styles.searchInput} placeholder="搜索 Agent..." />
          <span className={styles.shortcut}>⌘ K</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.actionBtn}><Sparkles size={16} /><span>AI 助手</span></button>
          <div className={styles.avatarBtn}><span className={styles.avatar}>E</span><span>Ethan</span><ChevronDown size={14} /></div>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.header}>
          <div><h1>AI Agents</h1><p>智能体模板、运行任务和执行记录。</p></div>
        </div>

        {/* Featured Agent */}
        <div className={styles.featured}>
          <div className={`${styles.featIcon} ${styles[`icon${agent.color}`]}`}>
            <agent.icon size={32} />
          </div>
          <div className={styles.featInfo}>
            <h2>{agent.name}</h2>
            <p>{agent.desc}</p>
            <div className={styles.featMeta}>
              <span>触发: {agent.trigger}</span>
              <span>输出: {agent.output}</span>
              <span>分类: {agent.category}</span>
            </div>
            <button className={styles.runBtn} onClick={() => setShowRun(true)}>
              <Play size={14} /> 立即运行
            </button>
          </div>
        </div>

        {/* Agent cards */}
        <div className={styles.grid}>
          {AGENTS.map((a) => (
            <button
              key={a.id}
              className={`${styles.card} ${selectedAgent === a.id ? styles.cardActive : ""}`}
              onClick={() => setSelectedAgent(a.id)}
            >
              <div className={`${styles.cardIcon} ${styles[`icon${a.color}`]}`}><a.icon size={22} /></div>
              <strong>{a.name}</strong>
              <p>{a.desc}</p>
              <div className={styles.cardMeta}>
                <span>{a.trigger}</span>
                <span>{a.output}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Workflow */}
        <div className={styles.workflow}>
          <h3>执行流程</h3>
          <div className={styles.steps}>
            {["选择 Agent", "配置任务", "运行", "查看结果"].map((step, i) => (
              <div key={i} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span>{step}</span>
                {i < 3 && <ArrowRight size={14} />}
              </div>
            ))}
          </div>
        </div>

        {/* Execution history */}
        <div className={styles.section}>
          <h3>执行记录</h3>
          <div className={styles.execList}>
            {DEMO_EXECUTIONS.map((e) => (
              <div key={e.id} className={styles.execRow}>
                <span className={`${styles.execStatus} ${styles[`status${e.status}`]}`}>
                  {e.status === "done" ? <CheckCircle2 size={14} /> :
                   e.status === "running" ? <Loader2 size={14} className={styles.spin} /> :
                   <XCircle size={14} />}
                </span>
                <div className={styles.execInfo}>
                  <strong>{e.agent}</strong>
                  <span>{e.input}</span>
                </div>
                <span className={styles.execTime}>{e.created}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Run Dialog */}
      {showRun && (
        <div className={styles.overlay} onClick={() => setShowRun(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>运行 {agent.name}</h2>
            <p className={styles.modalDesc}>{agent.desc}</p>
            <textarea className={styles.textarea} placeholder="输入任务描述..." value={runInput} onChange={(e) => setRunInput(e.target.value)} rows={3} autoFocus />
            <div className={styles.modalNote}>当前版本创建任务模板，Agent 运行需接入 LLM 后端。</div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowRun(false)}>取消</button>
              <button className={styles.primaryBtn} onClick={handleRun}>创建任务</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span>Agent 模板: {AGENTS.length}</span>
        <span className={styles.statusSep}>·</span>
        <span>执行中: {DEMO_EXECUTIONS.filter((e) => e.status === "running").length}</span>
      </div>
    </div>
  );
}
