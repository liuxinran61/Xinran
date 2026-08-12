// ===== Chat Store — RAG 对话状态管理（Zustand）============================
//
// 核心流程：sendMessage → SSE 流式请求 → 逐 token 更新 streamingContent
//   → 流完成后拼装 assistantMsg → 重新拉取 DB 消息同步 ID
//
// 检索范围限定（互斥）：
//   - scopedDocId  — 限定到单个文档（点击文档行激活）
//   - scopedFolderId — 限定到单个文件夹（进入文件夹激活）
//   设置一个时自动清除另一个
//
// 会话管理：自动创建（首条问题前 30 字为标题）、切换、删除
import { create } from "zustand";
import { getSessions, createSession, deleteSession, getConversations, deleteConversation, toggleLike } from "../api/client";
import type { ConversationItem, ChatSession } from "../types";

const API = "http://localhost:8004";

interface ChatState {
  // Sessions
  sessions: ChatSession[];
  currentSessionId: string | null;

  // Messages (current session)
  messages: ConversationItem[];
  isLoading: boolean;
  streamingContent: string;

  // KB context
  currentKbId: string | null;

  // Document scope — restrict RAG to a single document
  scopedDocId: string | null;
  scopedDocName: string;

  // Folder scope — restrict RAG to documents inside a folder
  scopedFolderId: string | null;
  scopedFolderName: string;

  // Actions
  setKbId: (kbId: string) => void;
  setScopedDoc: (docId: string | null, docName?: string) => void;
  setScopedFolder: (folderId: string | null, folderName?: string) => void;
  loadSessions: () => Promise<void>;
  newSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  sendMessage: (question: string) => Promise<void>;
  removeMessage: (msgId: string) => Promise<void>;
  toggleLikeMsg: (msgId: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isLoading: false,
  streamingContent: "",
  currentKbId: null,

  scopedDocId: null,
  scopedDocName: "",

  // ── 切换 KB：清除所有状态，重新加载会话 ──────────
  setKbId: (kbId) => {
    set({ currentKbId: kbId, messages: [], currentSessionId: null, sessions: [], scopedDocId: null, scopedDocName: "", scopedFolderId: null, scopedFolderName: "" });
    // Load sessions async
    get().loadSessions();
  },

  // ── 限定检索到单文档（与 folder 互斥）────────────
  setScopedDoc: (docId, docName) => {
    set({ scopedDocId: docId, scopedDocName: docName || "", scopedFolderId: null, scopedFolderName: "" });
    if (docId) {
      // Reset messages for the new scope
      set({ messages: [], currentSessionId: null });
      get().loadSessions();
    }
  },

  // ── 限定检索到单文件夹（与 doc 互斥）─────────────
  setScopedFolder: (folderId, folderName) => {
    set({ scopedFolderId: folderId, scopedFolderName: folderName || "", scopedDocId: null, scopedDocName: "" });
    if (folderId) {
      // Reset messages for the new scope
      set({ messages: [], currentSessionId: null });
      get().loadSessions();
    }
  },

  loadSessions: async () => {
    const { currentKbId } = get();
    if (!currentKbId) return;
    try {
      const list = await getSessions(currentKbId);
      set({ sessions: list });
      if (list.length > 0 && !get().currentSessionId) {
        // Auto-select most recent session and load its messages
        await get().switchSession(list[0].id);
      }
    } catch { /* no sessions yet */ }
  },

  newSession: async () => {
    const { currentKbId } = get();
    if (!currentKbId) return;
    try {
      const s = await createSession(currentKbId);
      set((st) => ({
        sessions: [s, ...st.sessions],
        currentSessionId: s.id,
        messages: [],
        streamingContent: "",
      }));
    } catch { /* ignore */ }
  },

  switchSession: async (id) => {
    const { currentKbId } = get();
    if (!currentKbId) return;
    set({ currentSessionId: id, messages: [], streamingContent: "" });
    try {
      const history = await getConversations(currentKbId, id);
      set({ messages: history });
    } catch { /* ignore */ }
  },

  removeSession: async (id) => {
    const { currentKbId, sessions, currentSessionId } = get();
    if (!currentKbId) return;
    try {
      await deleteSession(currentKbId, id);
      const remaining = sessions.filter((s) => s.id !== id);
      if (currentSessionId === id) {
        if (remaining.length > 0) {
          set({ sessions: remaining });
          await get().switchSession(remaining[0].id);
        } else {
          set({ sessions: [], currentSessionId: null, messages: [] });
        }
      } else {
        set({ sessions: remaining });
      }
    } catch { /* ignore */ }
  },

  // ── 核心：发送消息 → SSE 流式接收 ─────────────────
  sendMessage: async (question) => {
    const { currentKbId, currentSessionId, messages, scopedDocId, scopedFolderId } = get();
    if (!currentKbId || !question.trim()) return;

    // 自动创建会话（首条问题前 30 字为标题）
    let sid = currentSessionId;
    if (!sid) {
      try {
        const s = await createSession(
          currentKbId,
          question.slice(0, 30) + (question.length > 30 ? "..." : ""),
        );
        sid = s.id;
        set((st) => ({
          sessions: [s, ...st.sessions],
          currentSessionId: s.id,
        }));
      } catch { return; }
    }

    const userMsg: ConversationItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      session_id: sid,
      created_at: new Date().toISOString(),
    };
    set({ messages: [...messages, userMsg], isLoading: true, streamingContent: "" });

    // ── SSE 流式请求 ──────────────────────────────────
    try {
      const response = await fetch(`${API}/api/knowledge-bases/${currentKbId}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question, top_k: 5, session_id: sid,
            ...(scopedDocId ? { doc_id: scopedDocId } : {}),
            ...(scopedFolderId ? { folder_id: scopedFolderId } : {}),
          }),
      });

      // ReadableStream 逐行解析 SSE（POST 不能用 EventSource）
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullAnswer = "";
      let sources: any[] = [];
      let serverSessionId = sid;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            // SSE 帧格式: {token: "..."}  |  {sources: [...], session_id: "..."}  |  [DONE]
            if (data.token) {
              fullAnswer += data.token;
              set({ streamingContent: fullAnswer });
            } else if (data.sources) {
              sources = data.sources;
              if (data.session_id) serverSessionId = data.session_id;
            }
          } catch { /* skip malformed */ }
        }
      }

      const assistantMsg: ConversationItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullAnswer || "无回答",
        sources,
        session_id: serverSessionId,
        created_at: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, assistantMsg],
        isLoading: false,
        streamingContent: "",
      }));

      // 流结束后重新拉取：同步 DB 中的消息 ID + 更新会话计数
      const { currentKbId: kbId } = get();
      if (kbId) {
        try {
          const list = await getSessions(kbId);
          set({ sessions: list });
          // Sync DB message IDs
          const history = await getConversations(kbId, serverSessionId);
          if (history.length > 0) set({ messages: history });
        } catch { /* keep local state */ }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "请求失败";
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `[错误] ${msg}`,
            session_id: sid,
            created_at: new Date().toISOString(),
          },
        ],
        isLoading: false,
        streamingContent: "",
      }));
    }
  },

  removeMessage: async (msgId) => {
    const { currentKbId } = get();
    if (!currentKbId) return;
    set((s) => ({ messages: s.messages.filter((m) => m.id !== msgId) }));
    try {
      await deleteConversation(currentKbId, msgId);
    } catch { /* best effort */ }
  },

  // ── 点赞（乐观更新 + 失败回滚）───────────────────
  toggleLikeMsg: async (msgId) => {
    const { currentKbId } = get();
    if (!currentKbId) return;
    // Optimistic update
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId ? { ...m, liked: !m.liked } : m
      ),
    }));
    try {
      await toggleLike(currentKbId, msgId);
    } catch {
      // Revert on failure
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === msgId ? { ...m, liked: !m.liked } : m
        ),
      }));
    }
  },

  clearMessages: () => set({ messages: [], streamingContent: "" }),
}));
