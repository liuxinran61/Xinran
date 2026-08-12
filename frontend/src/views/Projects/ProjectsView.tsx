// ===== AI Knowledge OS Web — Projects View =====
import { useState } from "react";
import {
  Search, Sparkles, Lightbulb, ChevronDown, Plus,
  Folder, CircleCheckBig, ListChecks, Clock, AlertTriangle,
  CheckCircle2, Target, Calendar, Users, FileText,
  ArrowRight, Tag, GitFork, Building2,
} from "lucide-react";
import type { Project, ProjectTask } from "../../types";
import styles from "./ProjectsView.module.css";

const STATUS_LABEL: Record<string, string> = {
  planning: "规划中", research: "需求调研", development: "开发中",
  active: "进行中", done: "已完成",
};

// Demo projects
const DEMO_PROJECTS: Project[] = [
  {
    id: "1", name: "企业 AI 转型咨询", description: "为某金融机构提供 AI 能力建设方案",
    status: "active", progress: 65, due_date: "2026-09-15",
    client: "某银行", summary: "交付知识库 + Agent + 培训三件套",
    tags: ["AI技术", "企业案例"], owners: ["Ethan", "Lisa"],
    taskCount: 12, completedTaskCount: 8, meetingCount: 4,
    kb_id: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: "2", name: "RAG 知识库产品设计", description: "设计面向中小企业的 RAG 知识库产品",
    status: "development", progress: 40, due_date: "2026-10-01",
    client: "内部项目", summary: "产品定位 + 技术选型 + MVP 设计",
    tags: ["产品方案", "RAG"], owners: ["Ethan"],
    taskCount: 20, completedTaskCount: 8, meetingCount: 2,
    kb_id: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: "3", name: "内容知识库搭建", description: "搭建面向内容创作的素材知识库",
    status: "done", progress: 100, due_date: "2026-08-01",
    client: "内部项目", summary: "采集、分类、标签体系 + AI 搜索",
    tags: ["内容素材"], owners: ["Ethan"],
    taskCount: 8, completedTaskCount: 8, meetingCount: 0,
    kb_id: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
];

const COLLECTIONS = [
  { label: "企业AI转型", icon: Building2, color: "purple" },
  { label: "Agent实施手册", icon: GitFork, color: "blue" },
  { label: "客户需求分析", icon: Users, color: "teal" },
  { label: "内容生产系统", icon: FileText, color: "orange" },
];

export function ProjectsView() {
  const [projects] = useState(DEMO_PROJECTS);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string>(DEMO_PROJECTS[0].id);

  const filtered = projects.filter((p) => {
    if (!filter) return true;
    return `${p.name} ${p.client} ${p.tags?.join(" ")}`.toLowerCase().includes(filter.toLowerCase());
  });

  const selected = projects.find((p) => p.id === selectedId) || projects[0];
  const active = projects.filter((p) => p.status !== "done");
  const completed = projects.filter((p) => p.status === "done");
  const pendingTasks = projects.reduce((s, p) => s + p.taskCount - p.completedTaskCount, 0);
  const isRisky = selected.due_date && selected.progress < 80 &&
    new Date(selected.due_date).getTime() - Date.now() < 3 * 86400000;

  return (
    <div className={styles.center}>
      <div className={styles.topbar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input type="search" className={styles.searchInput} placeholder="搜索项目、任务、客户..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <span className={styles.shortcut}>⌘ K</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.actionBtn}><Sparkles size={16} /><span>AI 助手</span></button>
          <button className={styles.actionBtn}><Lightbulb size={16} /><span>今日洞察</span></button>
          <div className={styles.avatarBtn}><span className={styles.avatar}>E</span><span>Ethan</span><ChevronDown size={14} /></div>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.header}>
          <div>
            <h1>Projects</h1>
            <p>将知识、任务、客户与交付流程组织成可执行的项目系统。</p>
          </div>
          <button className={styles.createBtn}><Plus size={18} /> 创建项目</button>
        </div>

        {/* Stat row */}
        <div className={styles.statRow}>
          {[
            { label: "进行中", value: active.length, icon: Folder, color: "purple" },
            { label: "已完成", value: completed.length, icon: CircleCheckBig, color: "green" },
            { label: "待处理任务", value: pendingTasks, icon: ListChecks, color: "orange" },
            { label: "平均进度", value: `${Math.round(projects.reduce((s, p) => s + p.progress, 0) / Math.max(1, projects.length))}%`, icon: Target, color: "blue", isStr: true },
          ].map((s) => (
            <div key={s.label} className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles[`icon${s.color}`]}`}><s.icon size={18} /></div>
              <div><span className={styles.statLabel}>{s.label}</span><strong>{s.value as string}</strong></div>
            </div>
          ))}
        </div>

        {/* Project focus */}
        {selected && (
          <div className={styles.focus}>
            <div className={styles.focusLeft}>
              <div className={styles.focusHeader}>
                <div><h2>{selected.name}</h2><p>{selected.summary}</p></div>
                <span className={`${styles.badge} ${styles[`badge${selected.status}`]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>
              <div className={styles.progressBar}>
                <span style={{ width: `${selected.progress}%` }} />
              </div>
              <div className={styles.focusMeta}>
                <span><Calendar size={14} /> {selected.due_date || "未设定"}</span>
                <span><Users size={14} /> {selected.owners?.join(", ")}</span>
                <span><ListChecks size={14} /> {selected.completedTaskCount}/{selected.taskCount} 任务</span>
                <span><Tag size={14} /> {selected.tags?.join(", ")}</span>
              </div>
              {isRisky && (
                <div className={styles.riskAlert}>
                  <AlertTriangle size={14} /> 截止日期临近（{selected.due_date}），当前进度仅 {selected.progress}%，建议优先推进
                </div>
              )}
            </div>
            <div className={styles.focusRight}>
              <div className={styles.focusStat}><strong>{selected.meetingCount}</strong><span>沟通记录</span></div>
              <div className={styles.focusStat}><strong>{selected.taskCount - selected.completedTaskCount}</strong><span>剩余任务</span></div>
            </div>
          </div>
        )}

        {/* Project list */}
        <div className={styles.section}>
          <h3>全部项目</h3>
          <div className={styles.projectList}>
            {filtered.map((p) => (
              <button
                key={p.id}
                className={`${styles.projectRow} ${selectedId === p.id ? styles.rowActive : ""}`}
                onClick={() => setSelectedId(p.id)}
              >
                <div className={styles.rowInfo}>
                  <strong>{p.name}</strong>
                  <span>{p.client} · {STATUS_LABEL[p.status]}</span>
                </div>
                <div className={styles.rowRight}>
                  <span className={styles.progress}>{p.progress}%</span>
                  <ArrowRight size={14} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Collections */}
        <div className={styles.section}>
          <h3>知识集合</h3>
          <div className={styles.collectionGrid}>
            {COLLECTIONS.map((c) => (
              <button key={c.label} className={styles.collectionCard}>
                <div className={`${styles.collIcon} ${styles[`icon${c.color}`]}`}><c.icon size={20} /></div>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Weekly report */}
        <div className={styles.section}>
          <button className={styles.reportBtn}>
            <FileText size={16} /> 生成本周项目周报
          </button>
        </div>
      </div>

      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span>进行中: {active.length}</span>
        <span className={styles.statusSep}>·</span>
        <span>已完成: {completed.length}</span>
      </div>
    </div>
  );
}
