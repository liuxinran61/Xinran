// ===== Agent Panel — LLM function-calling agent =====
import { useState, useEffect, useRef } from "react";
import {
  PanelRightClose, PanelRightOpen, Upload, Globe,
  Send, FileText, Check, X, Loader2, ChevronDown, Paperclip,
  Bot, User, Users, Wrench,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { listKBs } from "../../api/client";
import type { KnowledgeBase } from "../../types";
import { getSkills, type SkillContext } from "../../skills/registry";
import styles from "./Copilot.module.css";

const API_BASE = "http://localhost:8004";
const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.markdown,.pptx,.ppt,.html,.htm,.xml,.json,.log,.properties,.yaml,.yml,.toml,.ini,.cfg,.png,.jpg,.jpeg,.gif,.bmp,.webp,.svg,.ico,.tiff,.tif,.heic,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.avi,.mkv,.webm";

// ── Agent system prompt ──────────────────────────────────

const AGENT_SYSTEM = `你是一个知识库助手，帮用户将文档和链接导入知识库。

## 你可以使用的工具
- **import_url**: 导入网页链接。当用户提供网页URL时自动调用。
- **upload_file**: 上传本地文件。当用户想上传文档、图片等文件时调用。

## 回复原则
- 用中文，简洁友好，不要啰嗦
- 用户发出"帮我把 xxx 链接导入"之类的请求 → 直接调用 import_url，不要反问"要导入吗"
- 用户说"上传文件"、"导入文档"等 → 调用 upload_file
- 用户只是聊天、问候、问你能做什么 → 直接文字回复，不要调用工具
- 导入成功后一句话确认即可，不要编造细节`;

// ── OpenAI tool definitions ──────────────────────────────

const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "import_url",
      description: "导入网页链接到知识库。抓取网页内容、提取正文后入库。当用户提供URL或要求导入网页时使用。",
      parameters: {
        type: "object" as const,
        properties: {
          url: { type: "string", description: "要导入的网页完整URL，必须以 http:// 或 https:// 开头" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "upload_file",
      description: "上传本地文件到知识库。当用户想上传文档、图片、音视频等本地文件时调用。调用后系统会自动打开文件选择器。",
      parameters: { type: "object" as const, properties: {}, required: [] },
    },
  },
];

// ── Types ────────────────────────────────────────────────

interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  status?: "thinking" | "tool" | "done" | "error";
  attachment?: { name: string; size?: number; type: "file" | "url" };
  toolName?: string;
}

interface ToolCallMessage {
  role: "assistant";
  content: string | null;
  tool_calls: { id: string; function: { name: string; arguments: string } }[];
}

interface ToolResultMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | ToolCallMessage
  | ToolResultMessage
  | { role: "assistant"; content: string };

// ── Component ────────────────────────────────────────────

export function Copilot() {
  const collapsed = useUIStore((s) => s.copilotCollapsed);
  const toggleCopilot = useUIStore((s) => s.toggleCopilot);

  // Panel resize
  const [panelWidth, setPanelWidth] = useState(360);
  const resizing = useRef(false);
  const panelRef = useRef<HTMLElement>(null);

  // KB
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("");
  const [kbDropdownOpen, setKbDropdownOpen] = useState(false);
  const kbRef = useRef<HTMLDivElement>(null);

  // Chat
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment menu
  const [attachOpen, setAttachOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [showUrlForm, setShowUrlForm] = useState(false);

  const skills = getSkills();

  useEffect(() => {
    listKBs().then((list) => {
      setKbs(list);
      if (list.length > 0 && !selectedKbId) setSelectedKbId(list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (kbRef.current && !kbRef.current.contains(e.target as Node)) setKbDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Panel resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      setPanelWidth(Math.max(280, Math.min(600, window.innerWidth - e.clientX)));
    };
    const onUp = () => { resizing.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  const startResize = () => {
    resizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const selectedKb = kbs.find((k) => k.id === selectedKbId);
  const personalKBs = kbs.filter((k) => k.visibility !== "shared");
  const sharedKBs = kbs.filter((k) => k.visibility === "shared");

  const skillCtx: SkillContext = {
    kbId: selectedKbId,
    kbName: selectedKb?.name || "",
    apiBase: API_BASE,
  };

  // ── Agent loop ─────────────────────────────────────────

  const addMsg = (role: "user" | "agent", content: string, extra?: Partial<AgentMessage>) => {
    const msg: AgentMessage = { id: crypto.randomUUID(), role, content, status: role === "agent" ? "done" : undefined, ...extra };
    setMessages((prev) => [...prev, msg]);
    return msg;
  };

  /** Execute a tool locally, return result as JSON string */
  const executeTool = async (name: string, args: Record<string, any>): Promise<string> => {
    if (name === "import_url") {
      try {
        const res = await fetch(`${API_BASE}/api/knowledge-bases/${selectedKbId}/import-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: args.url, title: "" }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return JSON.stringify({ success: true, message: `链接导入成功` });
      } catch (e: any) {
        return JSON.stringify({ success: false, message: e?.message || "导入失败" });
      }
    }
    if (name === "upload_file") {
      // Trigger file picker async
      setTimeout(() => fileInputRef.current?.click(), 100);
      return JSON.stringify({ success: true, action: "pick_file", message: "文件选择器已打开" });
    }
    return JSON.stringify({ success: false, message: `未知工具: ${name}` });
  };

  /** Main agent loop: send messages → get tool_calls or text → execute → repeat */
  const runAgent = async (userText: string) => {
    if (!selectedKbId) {
      addMsg("agent", "请先在上方选择一个目标知识库。", { status: "error" });
      return;
    }

    const chatMessages: ChatMessage[] = [
      { role: "system", content: AGENT_SYSTEM },
      { role: "user", content: userText },
    ];

    setThinking(true);
    const thinkingId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: thinkingId, role: "agent", content: "", status: "thinking" }]);

    try {
      // Max 3 round-trips to prevent infinite loops
      for (let round = 0; round < 3; round++) {
        const resp = await fetch(`${API_BASE}/api/knowledge-bases/${selectedKbId}/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: chatMessages, tools: AGENT_TOOLS }),
        });
        if (!resp.ok) throw new Error(`Agent API error: ${resp.status}`);

        const data = await resp.json();

        if (data.type === "message") {
          // Final text response
          setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
          addMsg("agent", data.content || "（无回复）");
          break;
        }

        if (data.type === "tool_calls" && data.tool_calls?.length > 0) {
          // Show tool call in UI
          const toolNames = data.tool_calls.map((tc: any) => tc.function.name).join(", ");
          setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
          addMsg("agent", `🔧 正在执行: ${toolNames}`, { status: "tool", toolName: toolNames });

          // Add assistant tool_call message to chat history
          chatMessages.push({
            role: "assistant",
            content: null,
            tool_calls: data.tool_calls,
          });

          // Execute each tool
          for (const tc of data.tool_calls) {
            let args: Record<string, any> = {};
            try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }

            const result = await executeTool(tc.function.name, args);
            chatMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });

            // If file picker was triggered, show special message
            if (tc.function.name === "upload_file") {
              setMessages((prev) => [
                ...prev.filter((m) => m.status !== "tool"),
                { id: crypto.randomUUID(), role: "agent", content: "请在弹出的文件选择器中选择要上传的文件 📁", status: "done" },
              ]);
              setThinking(false);
              return; // Don't continue loop — wait for file selection
            }
          }

          // Show thinking again for next round
          const nextThinkingId = crypto.randomUUID();
          setMessages((prev) => [...prev, { id: nextThinkingId, role: "agent", content: "", status: "thinking" }]);
          continue;
        }

        throw new Error("Unexpected agent response type");
      }
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
      addMsg("agent", `❌ 出错了: ${e?.message || "未知错误"}`, { status: "error" });
    }
    setThinking(false);
  };

  // ── File upload handler ────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedKbId) { addMsg("agent", "请先选择目标知识库。", { status: "error" }); e.target.value = ""; return; }

    addMsg("user", `上传: ${file.name}`, { attachment: { name: file.name, size: file.size, type: "file" } });
    setThinking(true);
    const agentId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: agentId, role: "agent", content: "", status: "thinking" }]);

    try {
      const { executeFileUpload } = await import("../../skills/definitions/upload-file/index");
      const result = await executeFileUpload(file, skillCtx);
      setMessages((prev) => prev.filter((m) => m.id !== agentId));
      addMsg("agent", result.message, { status: result.success ? "done" : "error" });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== agentId));
      addMsg("agent", `❌ 上传失败: ${err?.message || "未知错误"}`, { status: "error" });
    }
    setThinking(false);
    e.target.value = "";
  };

  // ── URL import handler ─────────────────────────────────

  const handleSendUrl = () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    setUrlInput(""); setUrlTitle(""); setShowUrlForm(false); setAttachOpen(false);
    addMsg("user", `导入链接: ${urlTitle || url.slice(0, 60)}`, { attachment: { name: url, type: "url" } });

    // Use agent for the actual import
    runAgentDirect(url);
  };

  /** Send a direct tool call without user text (for URL form) */
  const runAgentDirect = async (url: string) => {
    if (!selectedKbId) return;
    const chatMessages: ChatMessage[] = [
      { role: "system", content: AGENT_SYSTEM },
      { role: "user", content: `请帮我导入这个链接: ${url}` },
    ];

    setThinking(true);
    const tId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: tId, role: "agent", content: "", status: "thinking" }]);

    try {
      const resp = await fetch(`${API_BASE}/api/knowledge-bases/${selectedKbId}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages, tools: AGENT_TOOLS }),
      });
      const data = await resp.json();

      setMessages((prev) => prev.filter((m) => m.id !== tId));

      if (data.type === "message") {
        addMsg("agent", data.content || "（无回复）");
      } else if (data.type === "tool_calls" && data.tool_calls?.length > 0) {
        // Execute tools directly
        chatMessages.push({ role: "assistant", content: null, tool_calls: data.tool_calls });
        for (const tc of data.tool_calls) {
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.function.arguments); } catch { /* */ }
          const result = await executeTool(tc.function.name, args);
          chatMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        // Get final response
        const resp2 = await fetch(`${API_BASE}/api/knowledge-bases/${selectedKbId}/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: chatMessages, tools: AGENT_TOOLS }),
        });
        const data2 = await resp2.json();
        addMsg("agent", data2.type === "message" ? (data2.content || "完成") : "已完成导入");
      }
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tId));
      addMsg("agent", `❌ 出错了: ${e?.message || ""}`, { status: "error" });
    }
    setThinking(false);
  };

  // ── Chat input ─────────────────────────────────────────

  const handleSend = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");

    // Auto-detect URL paste
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      addMsg("user", text, { attachment: { name: urlMatch[0], type: "url" } });
      runAgent(text);
    } else {
      addMsg("user", text);
      runAgent(text);
    }
  };

  // ── Render ─────────────────────────────────────────────

  const WelcomeScreen = () => (
    <div className={styles.welcome}>
      <Bot size={28} />
      <h3>你好，我是知识助手</h3>
      <p>帮您将文档和链接导入到知识库。可以直接发链接给我，也可以上传文件。</p>
      <div className={styles.quickRow}>
        <button className={styles.quickBtn} onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> 上传文件
        </button>
        <button className={styles.quickBtn} onClick={() => setShowUrlForm(true)}>
          <Globe size={14} /> 导入链接
        </button>
      </div>
    </div>
  );

  return (
    <aside
      ref={panelRef}
      className={`${styles.copilot} ${collapsed ? styles.collapsed : ""}`}
      style={collapsed ? undefined : { width: panelWidth, minWidth: panelWidth }}
    >
      {!collapsed && <div className={styles.resizeHandle} onMouseDown={startResize}><span className={styles.resizeGrip} /></div>}

      <div className={styles.header}>
        <div className={styles.title}><Bot size={16} /><strong>Agent</strong><span className={styles.badge}>AI</span></div>
        <button className={styles.toggleBtn} onClick={toggleCopilot}>{collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}</button>
      </div>

      {!collapsed && (
        <>
          {/* KB selector */}
          <div className={styles.kbBar} ref={kbRef}>
            <span className={styles.kbBarLabel}>目标库</span>
            <button className={styles.kbBarSelect} onClick={() => setKbDropdownOpen(!kbDropdownOpen)}>
              <span>{selectedKb?.name || "选择知识库"}</span>
              <ChevronDown size={10} className={kbDropdownOpen ? styles.chevronUp : ""} />
            </button>
            {kbDropdownOpen && (
              <div className={styles.kbDropdown}>
                <div className={styles.kbGroup}>
                  <div className={styles.kbGroupLabel}><User size={11} /> 个人知识库</div>
                  {personalKBs.length === 0 ? <div className={styles.kbGroupEmpty}>暂无</div> :
                    personalKBs.map((kb) => (
                      <button key={kb.id} className={`${styles.kbItem} ${selectedKbId === kb.id ? styles.kbItemActive : ""}`}
                        onClick={() => { setSelectedKbId(kb.id); setKbDropdownOpen(false); }}>
                        {kb.name}<span className={styles.kbCount}>{kb.document_count}</span>
                      </button>
                    ))}
                </div>
                <div className={styles.kbGroup}>
                  <div className={styles.kbGroupLabel}><Users size={11} /> 共享知识库</div>
                  {sharedKBs.length === 0 ? <div className={styles.kbGroupEmpty}>暂无</div> :
                    sharedKBs.map((kb) => (
                      <button key={kb.id} className={`${styles.kbItem} ${selectedKbId === kb.id ? styles.kbItemActive : ""}`}
                        onClick={() => { setSelectedKbId(kb.id); setKbDropdownOpen(false); }}>
                        {kb.name}<span className={styles.kbCount}>{kb.document_count}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className={styles.chatScroll}>
            {messages.length === 0 && <WelcomeScreen />}
            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.msg} ${msg.role === "user" ? styles.msgUser : styles.msgAgent}`}>
                <div className={styles.msgAvatar}>{msg.role === "user" ? <User size={14} /> : <Bot size={14} />}</div>
                <div className={styles.msgBody}>
                  {msg.attachment && (
                    <div className={styles.attachment}>
                      {msg.attachment.type === "file" ? <FileText size={14} /> : <Globe size={14} />}
                      <span>{msg.attachment.name}</span>
                      {msg.attachment.size && <span className={styles.attachSize}>{formatSize(msg.attachment.size)}</span>}
                    </div>
                  )}
                  {msg.status === "tool" && (
                    <div className={styles.toolBanner}>
                      <Wrench size={12} /> {msg.toolName}
                    </div>
                  )}
                  {msg.status === "thinking" && !msg.content ? (
                    <span className={styles.thinking}><Loader2 size={13} className={styles.spin} /> AI 思考中...</span>
                  ) : (
                    <div className={styles.msgText}>{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* URL form */}
          {showUrlForm && (
            <div className={styles.urlForm}>
              <div className={styles.urlFormHeader}><Globe size={14} /> 导入网页链接<button onClick={() => setShowUrlForm(false)}><X size={14} /></button></div>
              <input className={styles.urlInput} placeholder="粘贴网页链接 https://..." value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleSendUrl()} />
              <input className={styles.urlInput} placeholder="标题（可选）" value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)} style={{ marginTop: 6 }} />
              <button className={styles.urlSubmit} disabled={!urlInput.trim()} onClick={handleSendUrl}>确认导入</button>
            </div>
          )}

          <input ref={fileInputRef} type="file" hidden accept={FILE_ACCEPT} onChange={handleFileChange} />

          {/* Composer */}
          <div className={styles.composer}>
            <div className={styles.composerRow}>
              <div className={styles.attachWrap}>
                <button className={styles.attachBtn} onClick={() => setAttachOpen(!attachOpen)}><Paperclip size={15} /></button>
                {attachOpen && (
                  <div className={styles.attachMenu}>
                    <button onClick={() => { fileInputRef.current?.click(); setAttachOpen(false); }}>
                      <Upload size={14} /> 上传文件
                    </button>
                    <button onClick={() => { setShowUrlForm(true); setAttachOpen(false); }}>
                      <Globe size={14} /> 导入链接
                    </button>
                  </div>
                )}
              </div>
              <textarea className={styles.prompt} placeholder="发消息或粘贴链接..." value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                onPaste={(e) => {
                  const text = e.clipboardData?.getData("text") || "";
                  if (/^https?:\/\/[^\s]+$/.test(text.trim()) && input.trim() === "") {
                    e.preventDefault(); setInput(text.trim()); setTimeout(() => handleSend(), 50);
                  }
                }}
                rows={2} disabled={thinking} />
              <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || thinking}><Send size={15} /></button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function formatSize(b: number) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
