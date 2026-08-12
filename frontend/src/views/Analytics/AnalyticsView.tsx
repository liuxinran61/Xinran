// ===== AI Knowledge OS Web — Analytics View =====
import { useState } from "react";
import {
  Search, Sparkles, ChevronDown,
  ChartNoAxesCombined, NotebookText, Link2, Tag, FolderKanban,
  TrendingUp, TrendingDown, Brain, AlertTriangle, CircleCheck,
  FileText, Download,
} from "lucide-react";
import styles from "./AnalyticsView.module.css";

// Demo analytics data
const DEMO_DATA = {
  totalDocs: 156, totalChunks: 1240, totalEntities: 89, totalRelations: 210,
  totalStorage: 2_600_000, healthScore: 78, weekAdded: 12,
  growthTrend: [
    { date: "Mon", count: 8 }, { date: "Tue", count: 5 }, { date: "Wed", count: 12 },
    { date: "Thu", count: 3 }, { date: "Fri", count: 9 }, { date: "Sat", count: 2 }, { date: "Sun", count: 4 },
  ],
  tagDistribution: [
    ["AI技术", 42], ["企业案例", 28], ["产品方案", 18], ["学习资料", 22], ["内容素材", 15], ["技术架构", 12],
  ] as [string, number][],
  categoryDistribution: [
    ["AI 技术", 52], ["商业洞察", 34], ["项目案例", 28], ["内容资产", 22], ["其他", 20],
  ] as [string, number][],
  highValueNotes: [
    { name: "AI Agent 设计模式", links: 18 },
    { name: "企业 AI 转型方法论", links: 15 },
    { name: "RAG 系统架构", links: 12 },
    { name: "知识库搭建指南", links: 10 },
  ],
  gaps: [
    { label: "项目管理", count: 2, suggestion: "建议补充至少 3 篇项目实践文档" },
    { label: "客户案例", count: 1, suggestion: "建议将沟通记录整理为结构化案例" },
    { label: "技术架构", count: 3, suggestion: "继续连接架构文档到相关项目" },
  ],
};

export function AnalyticsView() {
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const maxGrowth = Math.max(...DEMO_DATA.growthTrend.map((d) => d.count), 1);

  return (
    <div className={styles.center}>
      <div className={styles.topbar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input type="search" className={styles.searchInput} placeholder="搜索分析数据..." />
        </div>
        <div className={styles.topActions}>
          <button className={styles.actionBtn}><Sparkles size={16} /><span>AI 助手</span></button>
          <div className={styles.avatarBtn}><span className={styles.avatar}>E</span><span>Ethan</span><ChevronDown size={14} /></div>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.header}>
          <div><h1>Analytics</h1><p>知识增长、链接、标签、价值与结构分析。</p></div>
          <button className={styles.reportBtn}><Download size={14} /> 生成分析周报</button>
        </div>

        {/* Stat row */}
        <div className={styles.statRow}>
          {[
            { label: "总文档", value: DEMO_DATA.totalDocs, icon: NotebookText, color: "purple" },
            { label: "总链接", value: DEMO_DATA.totalRelations, icon: Link2, color: "blue" },
            { label: "活跃标签", value: DEMO_DATA.tagDistribution.length, icon: Tag, color: "cyan" },
            { label: "健康度", value: `${DEMO_DATA.healthScore}%`, icon: Brain, color: "green", isStr: true },
          ].map((s) => (
            <div key={s.label} className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles[`icon${s.color}`]}`}><s.icon size={18} /></div>
              <div><span className={styles.statLabel}>{s.label}</span><strong>{s.value as string}</strong></div>
            </div>
          ))}
        </div>

        {/* Growth chart (CSS-only bar chart) */}
        <div className={styles.panel}>
          <h3><TrendingUp size={16} /> 本周增长趋势</h3>
          <div className={styles.barChart}>
            {DEMO_DATA.growthTrend.map((d) => (
              <div key={d.date} className={styles.barCol}>
                <span className={styles.barValue}>{d.count}</span>
                <div className={styles.bar}>
                  <span style={{ height: `${(d.count / maxGrowth) * 100}%` }} />
                </div>
                <span className={styles.barLabel}>{d.date}</span>
              </div>
            ))}
            <div className={styles.growthSummary}><TrendingUp size={14} /> 本周新增 {DEMO_DATA.weekAdded} 篇</div>
          </div>
        </div>

        {/* Bottom grid */}
        <div className={styles.bottomGrid}>
          {/* Tag distribution */}
          <div className={styles.panel}>
            <h3><Tag size={16} /> 标签分布</h3>
            {DEMO_DATA.tagDistribution.map(([tag, count]) => (
              <div key={tag} className={styles.tagRow}>
                <span>{tag}</span>
                <div className={styles.tagBar}><span style={{ width: `${(count / 42) * 100}%` }} /></div>
                <b>{count}</b>
              </div>
            ))}
          </div>

          {/* High value ranking */}
          <div className={styles.panel}>
            <h3><TrendingUp size={16} /> 高价值知识</h3>
            {DEMO_DATA.highValueNotes.map((note, i) => (
              <div key={i} className={styles.rankRow}>
                <span className={styles.rank}>#{i + 1}</span>
                <span className={styles.rankName}>{note.name}</span>
                <b>{note.links} 链接</b>
              </div>
            ))}
          </div>
        </div>

        {/* Gaps */}
        <div className={styles.panel}>
          <h3><AlertTriangle size={16} /> 知识结构缺口</h3>
          {DEMO_DATA.gaps.map((gap) => (
            <div key={gap.label} className={styles.gapRow}>
              <span className={gap.count < 3 ? styles.gapWarn : styles.gapOk}>
                {gap.count < 3 ? <AlertTriangle size={14} /> : <CircleCheck size={14} />}
              </span>
              <div><strong>{gap.label}</strong><p>{gap.suggestion}</p></div>
              <b>{gap.count} 篇</b>
            </div>
          ))}
        </div>

        {/* AI Assistant actions */}
        <div className={styles.aiActions}>
          {["总结本周知识表现", "分析高价值知识", "发现结构缺口", "生成知识周报", "追踪 AI 执行效果"].map((action) => (
            <button key={action} className={styles.aiActionBtn} onClick={() => setAiResponse(`${action}: 基于当前 ${DEMO_DATA.totalDocs} 篇文档的分析结果...`)}>
              <Sparkles size={14} /> {action}
            </button>
          ))}
        </div>
        {aiResponse && (
          <div className={styles.aiResponse}>
            <strong><Sparkles size={14} /> AI 分析</strong>
            <p>{aiResponse}</p>
          </div>
        )}
      </div>

      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span>总文档: {DEMO_DATA.totalDocs}</span>
        <span className={styles.statusSep}>·</span>
        <span>健康度: {DEMO_DATA.healthScore}%</span>
      </div>
    </div>
  );
}
