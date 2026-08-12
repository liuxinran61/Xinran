// ===== Type Definitions — Knowledge OS 全系统类型 =====

// ── Knowledge Base ──────────────────────────────────────

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  icon: string;
  document_count: number;
  entity_count: number;
  created_at: string;
  updated_at: string;
}

// ── Document ────────────────────────────────────────────

/** 文档解析状态：pending=待处理 → processing=处理中 → completed=已完成 | failed=失败 */
export type ParseStatus = "pending" | "processing" | "completed" | "failed";

/** 文档 AI 分类结果（由后端 classifier 自动生成） */
export interface DocumentClassification {
  scenario: string;      // 业务场景
  category: string;      // 内容类别
  severity: string;      // 严重级别
  confidence: number;    // 置信度 0-1
  keywords: string[];    // 提取关键词
  reason: string;        // 分类理由
}

export interface Document {
  id: string;
  kb_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  parse_status: ParseStatus;
  chunk_count: number;
  entity_count: number;
  classification?: DocumentClassification;
  version?: number;
  replaces_doc_id?: string;
  source_url?: string;
  tags?: string[];
  created_at: string;
}

// ── RAG / 聊天 ─────────────────────────────────────────

/** 检索来源片段 */
export interface SourceItem {
  chunk_id: string;
  content: string;
  score: number;           // 匹配度 0-1
  document_name: string;
}

/** 对话会话 — 一个 KB 下可有多个会话 */
export interface ChatSession {
  id: string;
  kb_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

/** 单条对话记录（用户问题 / AI 回答） */
export interface ConversationItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  session_id?: string;
  liked?: boolean;
  created_at: string;
}

// ── Knowledge Graph ─────────────────────────────────────

/** ECharts 力导向图节点 */
export interface GraphNode {
  id: string;
  name: string;
  type: string;          // 实体类型
  category: number;       // 分类索引（对应 categories 数组）
  symbolSize: number;     // 节点大小 = 关联度
  itemStyle?: { color?: string };
  aliases?: string[];
  properties?: Record<string, unknown>;
}

/** ECharts 力导向图边 */
export interface GraphEdge {
  source: string;        // 源节点 ID
  target: string;        // 目标节点 ID
  label: string;         // 边标签
  relation_type: string; // 关系类型
}

/** ECharts 力导向图分类（对应节点的 category 索引） */
export interface GraphCategory {
  name: string;
  itemStyle?: { color?: string };
}

/** 完整知识图谱数据 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: GraphCategory[];
}

// ── System Config ───────────────────────────────────────

/** 后端系统配置（GET /api/admin/config） */
export interface SystemConfig {
  llm_api_base: string;
  llm_model: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  rag_top_k: number;
  rag_similarity_threshold: number;
}
