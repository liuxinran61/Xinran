// ===== AI Knowledge OS Web — Type Definitions =====

// --- Knowledge Base ---
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

// --- Document ---
export interface Document {
  id: string;
  kb_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  parse_status: "pending" | "processing" | "completed" | "failed";
  chunk_count: number;
  entity_count: number;
  classification?: {
    scenario: string;
    category: string;
    severity: string;
    confidence: number;
    keywords: string[];
    reason: string;
  };
  version?: number;
  replaces_doc_id?: string;
  source_url?: string;
  tags?: string[];
  created_at: string;
}

export interface Chunk {
  id: string;
  doc_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface DocumentDetail extends Document {
  chunks: Chunk[];
}

// --- RAG ---
export interface SourceItem {
  chunk_id: string;
  content: string;
  score: number;
  document_name: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceItem[];
}

export interface SearchResult {
  chunk_id: string;
  content: string;
  score: number;
  document_name: string;
}

// --- Chat Session ---
export interface ChatSession {
  id: string;
  kb_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

// --- Conversation ---
export interface ConversationItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  session_id?: string;
  liked?: boolean;
  created_at: string;
}

// --- Graph ---
export interface GraphNode {
  id: string;
  name: string;
  type: string;
  category: number;
  symbolSize: number;
  itemStyle?: { color?: string };
  aliases?: string[];
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  relation_type: string;
}

export interface GraphCategory {
  name: string;
  itemStyle?: { color?: string };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: GraphCategory[];
}

// --- Entity / Relation ---
export interface Entity {
  id: string;
  kb_id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  properties: Record<string, unknown>;
}

export type EntityType =
  | "person"
  | "organization"
  | "concept"
  | "technology"
  | "product"
  | "location"
  | "event"
  | "time";

export interface Relation {
  id: string;
  kb_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  properties: Record<string, unknown>;
}

// --- System ---
export interface SystemStats {
  kb_count: number;
  document_count: number;
  chunk_count: number;
  entity_count: number;
  relation_count: number;
  total_storage_bytes: number;
}

export interface SystemConfig {
  llm_api_base: string;
  llm_model: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  rag_top_k: number;
  rag_similarity_threshold: number;
}

// --- Dashboard ---
export interface DashboardStats {
  fileCount: number;
  linkCount: number;
  taskCount: number;
  totalSize: number;
  orphans: number;
  inboxCount: number;
  tagCount: number;
  density: number;
}

// --- Inbox ---
export interface InboxItem {
  id: string;
  title: string;
  content: string;
  source_type: "quick_note" | "web_capture" | "upload";
  source_url?: string;
  tags: string[];
  category: string;
  suggestedTags?: string[];
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
}

// --- Project ---
export interface Project {
  id: string;
  kb_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  due_date?: string;
  client?: string;
  summary?: string;
  tags: string[];
  owners: string[];
  taskCount: number;
  completedTaskCount: number;
  meetingCount: number;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = "planning" | "research" | "development" | "active" | "done";

export interface ProjectTask {
  id: string;
  project_id: string;
  content: string;
  is_completed: boolean;
  sort_order: number;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  target_date?: string;
  is_reached: boolean;
}

// --- Agent ---
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  system_prompt: string;
  trigger_keywords: string[];
  output_format: string;
  icon: string;
  color: string;
}

export interface AgentExecution {
  id: string;
  agent_id: string;
  kb_id: string;
  status: "pending" | "running" | "done" | "failed";
  input: string;
  output: string;
  created_at: string;
  completed_at?: string;
}

// --- Analytics ---
export interface AnalyticsOverview {
  totalDocs: number;
  totalChunks: number;
  totalEntities: number;
  totalRelations: number;
  totalStorage: number;
  healthScore: number;
  weekAdded: number;
}

export interface GapItem {
  label: string;
  count: number;
  suggestion: string;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  growthTrend: { date: string; count: number }[];
  tagDistribution: [string, number][];
  categoryDistribution: [string, number][];
  highValueNotes: { name: string; links: number }[];
  gaps: GapItem[];
}
