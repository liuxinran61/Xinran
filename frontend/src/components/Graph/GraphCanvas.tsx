// ===== GraphCanvas — ECharts 力导向知识图谱渲染 ============================
//
// 输入：GraphData（nodes + edges + categories）
// 输出：交互式 ECharts force 布局图谱
//
// ECharts 配置要点：
//   - layout: "force" — 力导向自动布局
//   - symbolSize — 节点大小由后端关联度决定（别名数量）
//   - category → 按实体类型着色（12 色主题对应）
//   - force.repulsion: 350 — 节点排斥力
//   - force.edgeLength: [120, 280] — 边长度范围
//   - label.position: "right" — 标签在节点右侧
//   - emphasis.focus: "adjacency" — 悬停高亮邻接节点
//   - tooltip — 显示节点名、类型、别名
//   - 支持 roam 缩放/拖拽、draggable 节点拖拽
import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { GraphData, GraphNode } from "../../types";

interface Props { data: GraphData | null; onNodeClick?: (node: GraphNode) => void; height?: number; }

const CATEGORY_COLORS: Record<string, string> = {
  "退款诉求": "#f5222d", "投诉威胁": "#fa8c16", "专业人士进线": "#1677ff",
  "代家人进线": "#722ed1", "关联订单": "#13c2c2", "三方平台": "#52c41a",
  "非我司公司": "#eb2f96", "支付渠道": "#2f54eb", "解约解绑银行卡": "#fa541c",
  "多次主动询问保司": "#a0d911", "质问查不到扣费": "#faad14", "其他": "#8c8c8c",
};

// ── ECharts 初始化 & 销毁 ───────────────────────────────

export function GraphCanvas({ data, onNodeClick, height = 500 }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data) return;
    if (!instanceRef.current) instanceRef.current = echarts.init(chartRef.current, undefined, { backgroundColor: "transparent" });
    const chart = instanceRef.current;
    const categories = (data.categories || []).map((c) => ({ name: c.name, itemStyle: { color: CATEGORY_COLORS[c.name] || "#3370ff" } }));

    chart.setOption({
      // ── Tooltip：悬停显示节点名 + 类型 + 别名 ───────
      tooltip: {
        trigger: "item", backgroundColor: "#fff", borderColor: "#e5e6eb",
        textStyle: { color: "#1f2329", fontSize: 12 },
        formatter: (p: unknown) => { const d = (p as { data?: GraphNode })?.data; if (!d) return ""; return `<b>${d.name}</b><br/>类型: ${d.type||"未知"}${d.aliases?.length?`<br/>别名: ${d.aliases.join(", ")}`:""}`; },
      },
      // ── 图例（左侧垂直排列）──────────────────────
      legend: { data: categories.map((c) => c.name), orient: "vertical", left: 12, top: 16, textStyle: { color: "#646a73", fontSize: 11 } },
      // ── 力导向图系列 ──────────────────────────────
      series: [{
        type: "graph", layout: "force",
        data: data.nodes.map((n) => ({ id: n.id, name: n.name, symbolSize: n.symbolSize||30, category: categories.findIndex((c) => c.name === n.type), itemStyle: { color: CATEGORY_COLORS[n.type]||"#3370ff" }, ...n.properties })),
        links: data.edges.map((e) => ({ source: e.source, target: e.target, label: { show: true, formatter: e.label, fontSize: 10, color: "#8f959e" }, lineStyle: { color: "#d0d4da", curveness: 0.2 } })),
        categories, roam: true, draggable: true,
        // ── 力参数 ─────────────────────────────────
        force: { repulsion: 350, edgeLength: [120, 280], gravity: 0.08 },
        // ── 悬停高亮邻接节点 ───────────────────────
        emphasis: { focus: "adjacency", lineStyle: { width: 3, color: "#3370ff" }, itemStyle: { shadowBlur: 20, shadowColor: "rgba(51,112,255,0.3)" } },
        label: { show: true, position: "right", fontSize: 11, color: "#646a73" },
        lineStyle: { opacity: 0.5 },
      }],
    }, true);

    // ── 节点点击 → 回调父组件显示详情 ──────────────
    chart.off("click");
    chart.on("click", (p: unknown) => {
      const d = (p as { dataType?: string; data?: GraphNode })?.data;
      if ((p as { dataType?: string }).dataType === "node" && onNodeClick && d) onNodeClick(d);
    });
    const h = () => chart.resize();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [data, onNodeClick]);

  useEffect(() => () => { instanceRef.current?.dispose(); instanceRef.current = null; }, []);

  return <div ref={chartRef} style={{ width:"100%", height, minHeight:400, background:"#fff", border:"1px solid var(--kos-border)", borderRadius:"var(--kos-radius)" }} />;
}
