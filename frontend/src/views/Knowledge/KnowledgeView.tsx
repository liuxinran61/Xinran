// ===== 保险客服 · 场景知识库 =====
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Plus, Search, Sparkles, ChevronDown, Loader2,
  AlertCircle, Flame, UserCheck, ShoppingCart, ExternalLink,
  HelpCircle, CreditCard, Unlink, Shield,
  Clock, Star, Tag, ArrowRight, FileText, Bot,
} from "lucide-react";
import { getClassified } from "../../api/client";
import styles from "./KnowledgeView.module.css";

const CATEGORY_ICONS: Record<string, typeof AlertCircle> = {
  "理赔类": AlertCircle, "纠纷类": Flame, "身份类": UserCheck,
  "支付类": CreditCard, "订单类": ShoppingCart,
};
const CATEGORY_COLORS: Record<string, string> = {
  "理赔类": "red", "纠纷类": "orange", "身份类": "purple",
  "支付类": "green", "订单类": "blue",
};
const SEVERITY_MAP: Record<string, string> = {
  "critical": "严重", "high": "高", "medium": "中", "low": "低",
};

export function KnowledgeView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showTips, setShowTips] = useState<string | null>(null);
  const [classifiedData, setClassifiedData] = useState<{
    categories: Array<{ category: string; count: number; scenarios: Array<{ name: string; count: number; items: Array<{ id: string; filename: string; scenario: string; category: string; severity: string; confidence: number; keywords: string[]; reason: string; parse_status: string; chunk_count: number }> }> }>;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClassified()
      .then(setClassifiedData)
      .catch(() => setClassifiedData(null))
      .finally(() => setLoading(false));
  }, []);

  const categories = classifiedData?.categories || [];
  const allItems = categories.flatMap((c) => c.scenarios.flatMap((s) => s.items));

  const filtered = allItems.filter((item) => {
    if (!search) return true;
    return `${item.scenario} ${item.category} ${item.filename}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className={styles.center}>
      <div className={styles.topbar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input type="search" className={styles.searchInput} placeholder="搜索场景、话术、流程..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className={styles.shortcut}>⌘ K</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.actionBtn}><Sparkles size={16} /><span>AI 话术</span></button>
          <div className={styles.avatarBtn}><span className={styles.avatar}>小</span><span>小陈</span><ChevronDown size={14} /></div>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.header}>
          <div><h1>场景知识库</h1><p>保险客服全场景话术、流程与处理经验。</p></div>
          <button className={styles.createBtn}><Plus size={18} /> 新增知识</button>
        </div>

        {/* Category cards — real data */}
        {loading ? (
          <div className={styles.loading}><Loader2 size={24} className={styles.spin} /> 加载分类数据...</div>
        ) : categories.length === 0 ? (
          <div className={styles.emptyBanner}>
            <BookOpen size={32} />
            <div>
              <strong>还没有分类数据</strong>
              <p>上传保险客服相关文档后，AI 会自动分类到对应场景大类</p>
            </div>
          </div>
        ) : (
          <div className={styles.catGrid}>
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.category] || Shield;
              const color = CATEGORY_COLORS[cat.category] || "purple";
              const scenarioNames = cat.scenarios.map((s) => s.name);
              return (
                <div key={cat.category} className={styles.catCard}>
                  <div className={`${styles.catIcon} ${styles[`color${color}`]}`}><Icon size={24} /></div>
                  <strong>{cat.category}</strong>
                  <span>{cat.count} 条文档</span>
                  <div className={styles.catScenarios}>
                    {scenarioNames.slice(0, 4).map((s) => <span key={s}>{s}</span>)}
                    {scenarioNames.length > 4 && <span>+{scenarioNames.length - 4}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Scenario knowledge cards — real data */}
        <div className={styles.section}>
          <h3><Shield size={16} /> AI 分类结果 ({filtered.length} 条文档)</h3>
          {filtered.length === 0 ? (
            <div className={styles.emptyBanner}>
              <Bot size={32} />
              <div>
                <strong>{classifiedData ? "无匹配结果" : "还没有分类数据"}</strong>
                <p>上传保险客服文档后，AI 会自动分类。每个文档都会被标记场景、大类、严重程度。</p>
              </div>
            </div>
          ) : (
            <div className={styles.knowledgeGrid}>
              {filtered.map((item) => (
                <div key={item.id} className={styles.knowledgeCard}>
                  <div className={styles.knowledgeHeader}>
                    <span className={`${styles.severity} ${styles[`sev${item.severity}`]}`}>
                      {item.severity === "critical" ? "🔴 严重" : item.severity === "high" ? "🟠 高" : item.severity === "medium" ? "🟡 中" : "🟢 低"}
                    </span>
                    <span className={styles.category}>{item.category}</span>
                    <span className={styles.confidence}>AI {(item.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <h3>{item.scenario}</h3>
                  <p className={styles.filename}>📄 {item.filename}</p>
                  <p className={styles.knowledgeContent}>{item.reason}</p>
                  <div className={styles.knowledgeMeta}>
                    <span><Clock size={12} /> {item.chunk_count} 分块</span>
                    {item.parse_status === "completed" && <span className={styles.effective}>✅ 已处理</span>}
                    {item.parse_status === "processing" && <span>⏳ 处理中</span>}
                  </div>
                  <div className={styles.knowledgeTags}>
                    {item.keywords?.map((kw) => <span key={kw} className={styles.tag}>{kw}</span>)}
                  </div>
                  <div className={styles.knowledgeActions}>
                    <button onClick={() => setShowTips(showTips === item.id ? null : item.id)}>
                      <Bot size={14} /> AI 话术推荐
                    </button>
                    <button onClick={() => navigate(`/knowledge/${item.id}`)}>
                      查看详情 <ArrowRight size={14} />
                    </button>
                  </div>
                  {showTips === item.id && (
                    <div className={styles.tips}>
                      <strong><Bot size={14} /> AI 推荐话术</strong>
                      <p>"您好，我理解您现在的情况。我先帮您核实{'"'}{item.scenario}{'"'}相关的信息，请稍等片刻..."</p>
                      <p>"根据我们的记录，您的保单状态是... 对于您提到的问题，我们的处理流程是..."</p>
                      <span className={styles.tipsNote}>以上话术仅供参考，请根据实际情况调整</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick tags */}
        <div className={styles.tagSection}>
          <h3><Tag size={16} /> 常用标签</h3>
          <div className={styles.tagCloud}>
            {["犹豫期", "全额退款", "监管投诉", "身份核实", "自动续费", "绑卡解约", "三方平台", "银保监会", "扣费争议", "升级处理", "首次进线", "多次进线"].map((t) => (
              <button key={t} className={styles.tag}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span>场景知识: 47 条</span>
        <span className={styles.statusSep}>·</span>
        <span>已验证: 42 条</span>
        <span className={styles.statusSep}>·</span>
        <span>平均时效: 18 min</span>
      </div>
    </div>
  );
}
