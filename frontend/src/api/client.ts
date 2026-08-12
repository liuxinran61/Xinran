// ===== API Client — 后端通信层 =====
// 所有请求通过 axios 实例统一发送到 localhost:8004
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8004",
  timeout: 120000, // LLM 调用超时 2 分钟
});

export default api;

// ── 知识库 CRUD ──────────────────────────────────────────

/** 获取所有知识库列表（个人 + 共享） */
export async function listKBs() {
  const { data } = await api.get("/api/knowledge-bases");
  return data;
}

/** 创建新知识库 */
export async function createKB(body: { name: string; description?: string }) {
  const { data } = await api.post("/api/knowledge-bases", body);
  return data;
}

/** 删除知识库 */
export async function deleteKB(id: string) {
  await api.delete(`/api/knowledge-bases/${id}`);
}

// ── 文档 CRUD ────────────────────────────────────────────

/** 列出知识库内所有文档 */
export async function listDocuments(kbId: string) {
  const { data } = await api.get(`/api/knowledge-bases/${kbId}/documents`);
  return data;
}

/** 上传文档到知识库（multipart/form-data） */
export async function uploadDocument(kbId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/api/knowledge-bases/${kbId}/documents`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/** 删除文档 */
export async function deleteDocument(id: string) {
  await api.delete(`/api/documents/${id}`);
}

/** 替换文档（更新版本）— 用于文档版本管理 */
export async function replaceDocument(docId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.put(`/api/documents/${docId}/replace`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── 对话会话管理 ─────────────────────────────────────────

/** 获取知识库下所有对话会话 */
export async function getSessions(kbId: string) {
  const { data } = await api.get(`/api/knowledge-bases/${kbId}/sessions`);
  return data;
}

/** 创建新对话会话 */
export async function createSession(kbId: string, title?: string) {
  const { data } = await api.post(`/api/knowledge-bases/${kbId}/sessions`, { title: title || "" });
  return data;
}

/** 删除对话会话 */
export async function deleteSession(kbId: string, sessionId: string) {
  await api.delete(`/api/knowledge-bases/${kbId}/sessions/${sessionId}`);
}

/** 获取会话内所有对话记录 */
export async function getConversations(kbId: string, sessionId?: string) {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const { data } = await api.get(`/api/knowledge-bases/${kbId}/conversations${params}`);
  return data;
}

/** 删除单条对话记录 */
export async function deleteConversation(kbId: string, convId: string) {
  await api.delete(`/api/knowledge-bases/${kbId}/conversations/${convId}`);
}

/** 点赞/取消点赞对话记录 */
export async function toggleLike(kbId: string, convId: string) {
  const { data } = await api.patch(`/api/knowledge-bases/${kbId}/conversations/${convId}/like`);
  return data;
}

// ── 知识图谱 ─────────────────────────────────────────────

/** 获取知识库的知识图谱数据（节点 + 边 + 分类） */
export async function getGraph(kbId: string) {
  const { data } = await api.get(`/api/knowledge-bases/${kbId}/graph`);
  return data;
}

// ── 系统配置 ─────────────────────────────────────────────

/** 获取系统配置（LLM / Embedding / 分块 / RAG 参数） */
export async function getConfig() {
  const { data } = await api.get("/api/admin/config");
  return data;
}
