// ===== AI Knowledge OS Web — API Client =====
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 120000, // 2 min for LLM calls
});

export default api;

// --- Knowledge Bases ---
export async function listKBs() {
  const { data } = await api.get("/api/knowledge-bases");
  return data;
}

export async function createKB(body: { name: string; description?: string }) {
  const { data } = await api.post("/api/knowledge-bases", body);
  return data;
}

export async function deleteKB(id: string) {
  await api.delete(`/api/knowledge-bases/${id}`);
}

// --- Documents ---
export async function listDocuments(kbId: string) {
  const { data } = await api.get(`/api/knowledge-bases/${kbId}/documents`);
  return data;
}

export async function uploadDocument(kbId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/api/knowledge-bases/${kbId}/documents`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDocument(id: string) {
  const { data } = await api.get(`/api/documents/${id}`);
  return data;
}

export async function deleteDocument(id: string) {
  await api.delete(`/api/documents/${id}`);
}

// --- RAG ---
export async function chat(kbId: string, question: string, topK = 5) {
  const { data } = await api.post(`/api/knowledge-bases/${kbId}/chat`, {
    question,
    top_k: topK,
  });
  return data;
}

export async function search(kbId: string, query: string, topK = 5) {
  const { data } = await api.post(`/api/knowledge-bases/${kbId}/search`, {
    query,
    top_k: topK,
  });
  return data;
}

export async function getConversations(kbId: string, sessionId?: string) {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const { data } = await api.get(`/api/knowledge-bases/${kbId}/conversations${params}`);
  return data;
}

// --- Chat Sessions ---
export async function getSessions(kbId: string) {
  const { data } = await api.get(`/api/knowledge-bases/${kbId}/sessions`);
  return data;
}

export async function createSession(kbId: string, title?: string) {
  const { data } = await api.post(`/api/knowledge-bases/${kbId}/sessions`, { title: title || "" });
  return data;
}

export async function deleteSession(kbId: string, sessionId: string) {
  await api.delete(`/api/knowledge-bases/${kbId}/sessions/${sessionId}`);
}

export async function deleteConversation(kbId: string, convId: string) {
  await api.delete(`/api/knowledge-bases/${kbId}/conversations/${convId}`);
}

export async function toggleLike(kbId: string, convId: string) {
  const { data } = await api.patch(`/api/knowledge-bases/${kbId}/conversations/${convId}/like`);
  return data; // { liked: boolean }
}

// --- Graph ---
export async function getGraph(kbId: string) {
  const { data } = await api.get(`/api/knowledge-bases/${kbId}/graph`);
  return data;
}

// --- Document Versions ---
export async function replaceDocument(docId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.put(`/api/documents/${docId}/replace`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDocumentVersions(docId: string) {
  const { data } = await api.get(`/api/documents/${docId}/versions`);
  return data.versions;
}

// --- Classification ---
export async function getClassified() {
  const { data } = await api.get("/api/classified");
  return data;
}

// --- System ---
export async function getStats() {
  const { data } = await api.get("/api/admin/stats");
  return data;
}

export async function getConfig() {
  const { data } = await api.get("/api/admin/config");
  return data;
}
