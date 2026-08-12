// ===== AI Knowledge OS Web — Graph View =====
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search, Sparkles, ChevronDown,
  Network, Layers, X, User, Users,
  Tag, Link2,
  Hash, RotateCcw,
} from "lucide-react";
import { listKBs, getGraph } from "../../api/client";
import { GraphCanvas } from "../../components/Graph/GraphCanvas";
import type { KnowledgeBase, GraphData, GraphNode } from "../../types";
import styles from "./GraphView.module.css";

// 12 insurance customer service business themes — aligned with backend extractor types
const TOPICS = [
  { id: "退款诉求", label: "退款诉求", color: "#f5222d" },
  { id: "投诉威胁", label: "投诉威胁", color: "#fa8c16" },
  { id: "专业人士进线", label: "专业人士进线", color: "#1677ff" },
  { id: "代家人进线", label: "代家人进线", color: "#722ed1" },
  { id: "关联订单", label: "关联订单", color: "#13c2c2" },
  { id: "三方平台", label: "三方平台", color: "#52c41a" },
  { id: "非我司公司", label: "非我司公司", color: "#eb2f96" },
  { id: "支付渠道", label: "支付渠道", color: "#2f54eb" },
  { id: "解约解绑银行卡", label: "解约解绑银行卡", color: "#fa541c" },
  { id: "多次主动询问保司", label: "多次主动询问保司", color: "#a0d911" },
  { id: "质问查不到扣费", label: "质问查不到扣费", color: "#faad14" },
  { id: "其他", label: "其他", color: "#8c8c8c" },
];

export function GraphView() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(false);

  // Search & KB dropdown state
  const [searchQuery, setSearchQuery] = useState("");
  const [kbDropdownOpen, setKbDropdownOpen] = useState(false);
  const kbDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listKBs().then((list) => {
      setKbs(list);
      if (list.length > 0) setSelectedKbId(list[0].id);
    }).catch(() => {});
  }, []);

  const fetchGraph = useCallback(async () => {
    if (!selectedKbId) return;
    setLoading(true);
    try {
      const data = await getGraph(selectedKbId);
      setGraphData(data);
    } catch {
      setGraphData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedKbId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Build entity → type map for edge filtering
  const entityTypeMap = useMemo(() => {
    if (!graphData) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const n of graphData.nodes) {
      map.set(n.id, n.type);
    }
    return map;
  }, [graphData]);

  // Multi-filter pipeline: topic type filter → search query
  const filteredData = useMemo(() => {
    if (!graphData) return null;

    let nodes = graphData.nodes;
    let edges = graphData.edges;

    // 1. Topic type filter (left sidebar) — exact match on entity type
    if (selectedTopic) {
      nodes = nodes.filter((n) => n.type === selectedTopic);
    }

    // 2. Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      nodes = nodes.filter((n) =>
        n.name.toLowerCase().includes(q) ||
        (n.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
        (n.type || "").toLowerCase().includes(q)
      );
    }

    // Filter edges to only show edges between visible nodes
    const visibleNodeIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    return { ...graphData, nodes, edges };
  }, [graphData, selectedTopic, searchQuery]);

  const nodeCount = filteredData?.nodes.length || 0;
  const edgeCount = filteredData?.edges.length || 0;
  const isFiltered = !!selectedTopic || !!searchQuery.trim();

  // Clear all filters
  const clearFilters = () => {
    setSelectedTopic("");
    setSearchQuery("");
  };

  // Group KBs for hierarchical dropdown
  const personalKBs = kbs.filter((k) => k.visibility !== "shared");
  const sharedKBs = kbs.filter((k) => k.visibility === "shared");
  const selectedKb = kbs.find((k) => k.id === selectedKbId);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (kbDropdownRef.current && !kbDropdownRef.current.contains(e.target as Node)) {
        setKbDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={styles.center}>
      {/* Topbar — header + KB selector */}
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>知识图谱</h1>
          <p className={styles.pageDesc}>按业务主题查看客服场景中的实体与关系。</p>
        </div>
        <div className={styles.topActions}>
          {/* Hierarchical KB dropdown */}
          <div className={styles.kbDropdown} ref={kbDropdownRef}>
            <button
              className={styles.kbDropdownBtn}
              onClick={() => setKbDropdownOpen(!kbDropdownOpen)}
            >
              <Network size={14} />
              <span>{selectedKb?.name || "选择知识库"}</span>
              <ChevronDown size={12} className={kbDropdownOpen ? styles.chevronUp : ""} />
            </button>
            {kbDropdownOpen && (
              <div className={styles.kbDropdownMenu}>
                {/* Personal KBs */}
                <div className={styles.kbGroup}>
                  <div className={styles.kbGroupLabel}><User size={12} /> 个人知识库</div>
                  {personalKBs.length === 0 ? (
                    <div className={styles.kbGroupEmpty}>暂无</div>
                  ) : personalKBs.map((kb) => (
                    <button
                      key={kb.id}
                      className={`${styles.kbItem} ${selectedKbId === kb.id ? styles.kbItemActive : ""}`}
                      onClick={() => { setSelectedKbId(kb.id); setKbDropdownOpen(false); }}
                    >
                      {kb.name}
                      <span className={styles.kbItemCount}>{kb.document_count}</span>
                    </button>
                  ))}
                </div>
                {/* Shared KBs */}
                <div className={styles.kbGroup}>
                  <div className={styles.kbGroupLabel}><Users size={12} /> 共享知识库</div>
                  {sharedKBs.length === 0 ? (
                    <div className={styles.kbGroupEmpty}>暂无</div>
                  ) : sharedKBs.map((kb) => (
                    <button
                      key={kb.id}
                      className={`${styles.kbItem} ${selectedKbId === kb.id ? styles.kbItemActive : ""}`}
                      onClick={() => { setSelectedKbId(kb.id); setKbDropdownOpen(false); }}
                    >
                      {kb.name}
                      <span className={styles.kbItemCount}>{kb.document_count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className={styles.settingsBtn} onClick={fetchGraph}>
            <Network size={14} /> 刷新
          </button>
        </div>
      </div>

      <div className={styles.scroll}>
        {/* Stat Cards */}
        <div className={styles.statRow}>
          {[
            { label: "节点数", value: nodeCount, icon: Hash, color: "purple" },
            { label: "连接数", value: edgeCount, icon: Link2, color: "blue" },
            { label: "总实体", value: graphData?.nodes.length || 0, icon: Layers, color: "cyan" },
            { label: "总关系", value: graphData?.edges.length || 0, icon: Network, color: "orange" },
          ].map((s) => (
            <div key={s.label} className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles[`icon${s.color}`]}`}>
                <s.icon size={18} />
              </div>
              <div>
                <span className={styles.statLabel}>{s.label}</span>
                <strong>{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</strong>
              </div>
            </div>
          ))}
        </div>

        {/* Main: Topic sidebar + Graph canvas */}
        <div className={styles.workspace}>
          {/* Left: Topic clusters as filter */}
          <div className={styles.clusters}>
            <div className={styles.clustersHeader}>
              <h3>业务主题</h3>
              {selectedTopic && (
                <button className={styles.clearTopic} onClick={() => setSelectedTopic("")}>
                  <X size={12} /> 清除
                </button>
              )}
            </div>
            {TOPICS.map((topic) => {
              const matchCount = graphData?.nodes.filter((n) => n.type === topic.id).length || 0;
              const isActive = selectedTopic === topic.id;
              const hasSelection = !!selectedTopic;
              return (
                <button
                  key={topic.id}
                  className={`${styles.clusterBtn} ${isActive ? styles.clusterActive : ""} ${hasSelection && !isActive ? styles.clusterDimmed : ""}`}
                  onClick={() => setSelectedTopic(isActive ? "" : topic.id)}
                >
                  <span
                    className={styles.clusterDot}
                    style={{ background: isActive ? topic.color : hasSelection ? "#d9d9d9" : topic.color }}
                  />
                  <span>{topic.label}</span>
                  <b>{matchCount}</b>
                </button>
              );
            })}
          </div>

          {/* Right: Search + Graph */}
          <div className={styles.graphArea}>
            {/* Search bar */}
            <div className={styles.searchRow}>
              <div className={styles.searchWrap}>
                <Search size={16} />
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="搜索节点名称、类型..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className={styles.searchClear} onClick={() => setSearchQuery("")}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {isFiltered && (
                <button className={styles.resetBtn} onClick={clearFilters}>
                  <RotateCcw size={14} /> 重置
                </button>
              )}
            </div>
            {/* Graph canvas */}
            <div className={styles.canvasWrap}>
              {loading ? (
                <div className={styles.empty}><p>加载图谱数据...</p></div>
              ) : !filteredData || filteredData.nodes.length === 0 ? (
                <div className={styles.empty}>
                  <Network size={40} />
                  <h3>{graphData && graphData.nodes.length > 0 ? "无匹配结果" : "暂无图谱数据"}</h3>
                  <p>
                    {graphData && graphData.nodes.length > 0
                      ? "当前筛选条件下没有匹配的节点，请调整搜索词或筛选条件。"
                      : "上传文档后，AI 会自动抽取实体和关系构建知识图谱。"
                    }
                  </p>
                  {isFiltered && (
                    <button className={styles.settingsBtn} onClick={clearFilters} style={{ marginTop: 12 }}>
                      <RotateCcw size={14} /> 清除所有筛选
                    </button>
                  )}
                </div>
              ) : (
                <GraphCanvas
                  data={filteredData}
                  height={500}
                  onNodeClick={(node) => setSelectedNode(node)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Node detail (if selected) */}
        {selectedNode && (
          <div className={styles.nodeDetail}>
            <div className={styles.nodeDetailHeader}>
              <h3>{selectedNode.name}</h3>
              <button onClick={() => setSelectedNode(null)}>×</button>
            </div>
            <div className={styles.nodeDetailBody}>
              <p><Tag size={14} /> 类型: {selectedNode.type}</p>
              {selectedNode.aliases?.length ? (
                <p><Hash size={14} /> 别名: {selectedNode.aliases.join(", ")}</p>
              ) : null}
              {selectedNode.symbolSize ? (
                <p><Layers size={14} /> 关联度: {selectedNode.symbolSize}</p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span>节点: {nodeCount}</span>
        <span className={styles.statusSep}>·</span>
        <span>连接: {edgeCount}</span>
        <span className={styles.statusSep}>·</span>
        <span>{isFiltered ? "已筛选" : "全部显示"}</span>
        <span className={styles.statusSep}>·</span>
        <span>{selectedKb?.name || "请选择知识库"}</span>
      </div>
    </div>
  );
}
