// ===== AI Knowledge OS Web — Knowledge Detail View =====
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Upload, Trash2, FileText, Search, Sparkles,
  Loader2, CircleCheck, Clock, AlertCircle, FileWarning, ChevronDown, ExternalLink,
  Database, Brain, Bot, RefreshCw, History,
} from "lucide-react";
import { listDocuments, uploadDocument, deleteDocument, replaceDocument } from "../../api/client";
import { useChatStore } from "../../stores/chatStore";
import type { Document } from "../../types";
import styles from "./KnowledgeDetailView.module.css";

const STATUS_ICON: Record<string, typeof CircleCheck> = {
  pending: Clock,
  processing: Loader2,
  completed: CircleCheck,
  failed: AlertCircle,
};
const STATUS_CLASS: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  completed: "completed",
  failed: "failed",
};

export function KnowledgeDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const { messages, isLoading: chatLoading, sendMessage, setKbId } = useChatStore();
  const [copilotOpen, setCopilotOpen] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!id) return;
    try {
      setDocs(await listDocuments(id));
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) setKbId(id);
    fetchDocs();
    const timer = setInterval(fetchDocs, 5000); // Poll for processing updates
    return () => clearInterval(timer);
  }, [id, fetchDocs, setKbId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    try {
      await uploadDocument(id, file);
      await fetchDocs();
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("确定删除此文档？")) return;
    await deleteDocument(docId);
    await fetchDocs();
  };

  const handleReplace = async (docId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.txt,.md,.pptx,.doc";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !id) return;
      await replaceDocument(docId, file);
      await fetchDocs();
    };
    input.click();
  };

  const handleChat = async () => {
    if (!question.trim()) return;
    await sendMessage(question);
    setQuestion("");
    setCopilotOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  };

  const stats = {
    total: docs.length,
    completed: docs.filter((d) => d.parse_status === "completed").length,
    processing: docs.filter((d) => d.parse_status === "processing").length,
    failed: docs.filter((d) => d.parse_status === "failed").length,
    totalSize: docs.reduce((sum, d) => sum + d.file_size, 0),
    totalChunks: docs.reduce((sum, d) => sum + d.chunk_count, 0),
  };

  return (
    <div className={styles.center}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => navigate("/knowledge")}>
          <ArrowLeft size={18} /> 返回
        </button>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input type="search" className={styles.searchInput} placeholder="搜索文档..." />
          <span className={styles.shortcut}>⌘ K</span>
        </div>
        <div className={styles.topActions}>
          <label className={styles.uploadBtn}>
            <Upload size={16} />
            <span>上传文档</span>
            <input type="file" hidden accept=".pdf,.docx,.txt,.md,.pptx,.doc" onChange={handleUpload} />
          </label>
          <button className={styles.chatToggle} onClick={() => setCopilotOpen(!copilotOpen)}>
            <Sparkles size={16} />
            <span>AI 对话</span>
          </button>
          <div className={styles.avatarBtn}>
            <span className={styles.avatar}>E</span><span>Ethan</span><ChevronDown size={14} />
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* Main Content */}
        <div className={styles.scroll}>
          {/* Stats */}
          <div className={styles.statRow}>
            {[
              { label: "文档", value: stats.total, icon: FileText, color: "purple" },
              { label: "已完成", value: stats.completed, icon: CircleCheck, color: "green" },
              { label: "处理中", value: stats.processing, icon: Loader2, color: "orange" },
              { label: "分块", value: stats.totalChunks, icon: Database, color: "blue" },
            ].map((s) => (
              <div key={s.label} className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles[`icon${s.color}`]}`}>
                  <s.icon size={18} />
                </div>
                <div>
                  <span className={styles.statLabel}>{s.label}</span>
                  <strong>{s.value}</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Uploading indicator */}
          {uploading && (
            <div className={styles.uploadBanner}>
              <Loader2 size={16} className={styles.spin} /> 正在上传并处理文档...
            </div>
          )}

          {/* Document Table */}
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colName}>文件名</span>
              <span className={styles.colType}>类型</span>
              <span className={styles.colSize}>大小</span>
              <span className={styles.colClassify}>AI 分类</span>
              <span className={styles.colStatus}>状态</span>
              <span className={styles.colAct}>操作</span>
            </div>
            {loading ? (
              <div className={styles.loadingRow}><Loader2 size={18} className={styles.spin} /> 加载中...</div>
            ) : docs.length === 0 ? (
              <div className={styles.emptyRow}>
                <FileWarning size={28} />
                <p>暂无文档，上传 PDF / Word / Markdown 开始</p>
              </div>
            ) : (
              docs.map((doc) => {
                const StatusIcon = STATUS_ICON[doc.parse_status] || FileText;
                const statusClass = STATUS_CLASS[doc.parse_status] || "";
                return (
                  <div key={doc.id} className={styles.tableRow}>
                    <div className={styles.colName}>
                      <FileText size={16} className={styles.fileIcon} />
                      <span title={doc.filename}>{doc.filename}</span>
                    </div>
                    <span className={styles.colType}>{doc.file_type?.toUpperCase()}</span>
                    <span className={styles.colSize}>{formatSize(doc.file_size)}</span>
                    <span className={styles.colClassify}>
                      {doc.classification ? (
                        <span className={styles.classifyTag} title={`${doc.classification.reason} (${(doc.classification.confidence * 100).toFixed(0)}%)`}>
                          <Bot size={12} /> {doc.classification.scenario}
                        </span>
                      ) : (
                        <span className={styles.classifyPending}>—</span>
                      )}
                    </span>
                    <span className={`${styles.colStatus} ${styles[`status${statusClass}`]}`}>
                      <StatusIcon size={14} className={doc.parse_status === "processing" ? styles.spin : ""} />
                      {doc.parse_status === "completed" ? "已完成" :
                       doc.parse_status === "processing" ? "处理中" :
                       doc.parse_status === "failed" ? "失败" : "等待中"}
                    </span>
                    <div className={styles.colActions}>
                      <button className={styles.colAct} onClick={() => handleReplace(doc.id)} title="更新文档">
                        <Upload size={13} />
                      </button>
                      <button className={styles.colAct} onClick={() => handleDelete(doc.id)} title="删除">
                        <Trash2 size={13} />
                      </button>
                      {doc.version && doc.version > 1 && (
                        <span className={styles.versionBadge} title={`v${doc.version}${doc.replaces_doc_id ? ' (替换旧版)' : ''}`}>v{doc.version}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Panel (right side) */}
        {copilotOpen && (
          <div className={styles.chatPanel}>
            <div className={styles.chatScroll}>
              {messages.length === 0 && (
                <div className={styles.chatEmpty}>
                  <Sparkles size={24} />
                  <p>基于当前知识库内容提问</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={msg.role === "user" ? styles.userMsg : styles.assistantMsg}>
                  <div className={styles.msgBubble}>
                    <p className={styles.msgText}>{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <details className={styles.msgSources}>
                        <summary>查看来源 ({msg.sources.length})</summary>
                        {msg.sources.map((s, i) => (
                          <div key={i} className={styles.sourceItem}>
                            <span className={styles.sourceDoc}>{s.document_name}</span>
                            <span className={styles.sourceScore}>{Math.round(s.score * 100)}%</span>
                            <p>{s.content.slice(0, 200)}...</p>
                          </div>
                        ))}
                      </details>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className={styles.assistantMsg}>
                  <div className={styles.msgBubble}>
                    <Loader2 size={16} className={styles.spin} />
                  </div>
                </div>
              )}
            </div>
            <div className={styles.chatInput}>
              <textarea
                placeholder="向 AI 提问..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={chatLoading}
              />
              <button onClick={handleChat} disabled={chatLoading || !question.trim()}>
                <Sparkles size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span>文档: {stats.total}</span>
        <span className={styles.statusSep}>·</span>
        <span>已完成: {stats.completed}</span>
        <span className={styles.statusSep}>·</span>
        <span>模型: gpt-4o-mini</span>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), u.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`;
}
