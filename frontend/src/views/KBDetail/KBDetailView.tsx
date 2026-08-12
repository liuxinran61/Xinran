// ===== KB Detail — folders + files + FAQ + streaming Q&A with sessions =====
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Upload, Trash2, FolderPlus, Plus, Search, Sparkles, ChevronRight, ChevronDown,
  FileText, Folder, HelpCircle, X, Loader2, Eye, Globe, Image, File, MessageSquarePlus,
  Copy, ThumbsUp, Check, PanelRightClose, PanelRightOpen, ArrowRightLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listDocuments, uploadDocument, deleteDocument } from "../../api/client";
import { useChatStore } from "../../stores/chatStore";
import { useToastStore } from "../../stores/toastStore";
import type { Document, KnowledgeBase } from "../../types";
import styles from "./KBDetailView.module.css";

const API_BASE = "http://localhost:8004";

const api = {
  getKB: async (id: string) => { const r = await fetch(`${API_BASE}/api/knowledge-bases/${id}`); return r.json(); },
  getFolders: async (id: string) => { const r = await fetch(`${API_BASE}/api/knowledge-bases/${id}/folders`); return r.json(); },
  createFolder: async (id: string, name: string, parentId?: string) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}/folders`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name,parent_id:parentId||null}) }); },
  deleteFolder: async (id: string, fid: string) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}/folders/${fid}`, { method:"DELETE" }); },
  updateDocument: async (docId: string, data: { folder_id?: string | null; filename?: string }) => { const r = await fetch(`${API_BASE}/api/documents/${docId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }); return r.json(); },
  getFAQ: async (id: string) => { const r = await fetch(`${API_BASE}/api/knowledge-bases/${id}/faq`); return r.json(); },
  createFAQ: async (id: string, q: string, a: string) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}/faq`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({question:q,answer:a}) }); },
  deleteFAQ: async (id: string, fid: string) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}/faq/${fid}`, { method:"DELETE" }); },
  updateKB: async (id: string, data: Record<string, unknown>) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }); },
  getDocContent: async (id: string) => { const r = await fetch(`${API_BASE}/api/documents/${id}`); return r.json(); },
};

export function KBDetailView() {
  const { id } = useParams<{ id: string }>();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFAQForm, setShowFAQForm] = useState(false);
  const [newQ, setNewQ] = useState(""); const [newA, setNewA] = useState("");
  const [question, setQuestion] = useState("");
  const [preview, setPreview] = useState<{ filename: string; content: string; type: string } | null>(null);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [uploadMenuPos, setUploadMenuPos] = useState({ top: 0, left: 0 });
  const uploadBtnRef = useRef<HTMLButtonElement>(null);
  const [movingDocId, setMovingDocId] = useState<string | null>(null); // which doc's folder picker is open
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);  // toggle chat panel
  const toast = useToastStore();
  const {
    sessions, currentSessionId, messages, isLoading, streamingContent,
    setKbId, newSession, switchSession, removeSession,
    sendMessage, removeMessage, toggleLikeMsg,
    scopedDocId, scopedDocName, setScopedDoc,
    scopedFolderId, scopedFolderName, setScopedFolder,
  } = useChatStore();

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [kbData, docData, folderData, faqData] = await Promise.all([
      api.getKB(id), listDocuments(id), api.getFolders(id), api.getFAQ(id),
    ]);
    setKb(kbData); setDocs(docData); setFolders(folderData); setFaqItems(faqData);
  }, [id]);

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 5000); return () => clearInterval(t); }, [fetchAll]);
  useEffect(() => { if (id) setKbId(id); }, [id, setKbId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !id) return;
    toast.show(`正在上传 ${file.name}...`, "info");
    try {
      await uploadDocument(id, file); fetchAll();
      toast.success(`${file.name} 上传成功`);
    } catch { toast.error("上传失败"); }
    e.target.value = "";
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim() || !id) return;
    await api.createFolder(id, newFolderName, selectedFolder || undefined);
    fetchAll(); setNewFolderName(""); setShowNewFolder(false);
    toast.success("文件夹已创建");
  };

  const handleAddFAQ = async () => {
    if (!newQ.trim() || !newA.trim()) return;
    await api.createFAQ(id!, newQ, newA); setNewQ(""); setNewA(""); setShowFAQForm(false); fetchAll();
  };

  const handleUrlImport = async () => {
    if (!importUrl.trim() || !id) return;
    setImporting(true);
    try {
      await fetch(`${API_BASE}/api/knowledge-bases/${id}/import-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim(), title: importTitle.trim() || undefined }),
      });
      setImportUrl(""); setImportTitle(""); setShowUrlImport(false); fetchAll();
      toast.success("网页导入成功");
    } catch { toast.error("导入失败"); }
    finally { setImporting(false); }
  };

  const handleChat = async () => {
    if (!question.trim() || !id) return;
    const q = question;
    setQuestion("");  // 立即清空，不等流式完成
    await sendMessage(q);
  };

  const handleCopy = async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard denied */ }
  };

  const handleRecQuestion = (q: string) => { sendMessage(q); };
  const handlePreview = async (doc: Document) => {
    try {
      const detail = await api.getDocContent(doc.id);
      const content = detail.chunks?.map((c: any) => c.content).join("\n\n") || "暂无内容";
      setPreview({ filename: doc.filename, content, type: doc.file_type });
    } catch {
      setPreview({ filename: doc.filename, content: "无法加载内容", type: doc.file_type });
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const filteredDocs = selectedFolder ? docs.filter((d) => (d as any).folder_id === selectedFolder) : docs;

  const getFolderName = (fid: string) => {
    const f = folders.find((x: any) => x.id === fid);
    if (f) return f.name;
    for (const x of folders) {
      const child = (x.children || []).find((c: any) => c.id === fid);
      if (child) return child.name;
    }
    return "...";
  };

  return (
    <div className={styles.center}>
      <div className={styles.topbar}>
        <h2>{kb?.name || "加载中..."}</h2>
        <span className={styles.kbBadge}>{kb?.visibility === "shared" ? "共享知识库" : "个人知识库"}</span>
        <div className={styles.topActions}>
          <span className={styles.docCount}>{docs.length} 个文档</span>
          <button
            className={styles.chatToggle}
            onClick={() => setChatOpen(!chatOpen)}
            title={chatOpen ? "收起对话框" : "展开对话框"}
          >
            {chatOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            {chatOpen ? "收起对话" : "AI 问答"}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* MAIN: Breadcrumb + Folder list + File table */}
        <div className={styles.mainArea}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <button
              className={`${styles.breadcrumbItem} ${!selectedFolder ? styles.breadcrumbActive : ""}`}
              onClick={() => { setSelectedFolder(null); setScopedFolder(null); }}>
              <Folder size={14} /> 全部文件
            </button>
            {selectedFolder && (
              <>
                <ChevronRight size={12} className={styles.breadcrumbSep} />
                <span className={`${styles.breadcrumbItem} ${styles.breadcrumbActive}`}>
                  <Folder size={14} /> {getFolderName(selectedFolder)}
                </span>
              </>
            )}
            <span className={styles.breadcrumbCount}>{filteredDocs.length} 个文件</span>
            <div className={styles.breadcrumbActions}>
              <button onClick={() => setShowNewFolder(true)} title="新建文件夹"><FolderPlus size={15} /></button>
              <button ref={uploadBtnRef}
                onClick={() => {
                  if (!uploadMenuOpen && uploadBtnRef.current) {
                    const rect = uploadBtnRef.current.getBoundingClientRect();
                    setUploadMenuPos({ top: rect.bottom + 4, left: rect.left });
                  }
                  setUploadMenuOpen(!uploadMenuOpen);
                }}
                title="上传文件"><Upload size={15} /></button>
            </div>
          </div>

          {/* Folder + File table — unified rows */}
          <div className={styles.tableCard}>
            {/* Root-level folders */}
            {!selectedFolder && folders.map((f: any) => (
              <div
                key={f.id}
                className={`${styles.tableRow} ${styles.folderRowHighlight} ${scopedFolderId === f.id ? styles.tableRowScoped : ""}`}
                onClick={() => { setSelectedFolder(f.id); setScopedFolder(f.id, f.name); }}
                title="进入文件夹，自动限定检索范围">
                <span className={styles.colIcon}><Folder size={16} /></span>
                <span className={styles.colName}>{f.name}</span>
                <span className={styles.colType}>文件夹</span>
                <span className={styles.colSize}>{f.children?.length || 0} 子目录</span>
                <span className={`${styles.colStatus} ${styles.statusDone}`}>{docs.filter((d) => (d as any).folder_id === f.id).length} 文件</span>
                <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                  <button title="删除文件夹" onClick={async () => { if (!window.confirm(`删除 "${f.name}"？其中的文件不会被删除。`)) return; await api.deleteFolder(id!, f.id); fetchAll(); toast.success("已删除"); }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {/* Sub-folders when inside a parent folder */}
            {selectedFolder && (folders.find((x: any) => x.id === selectedFolder)?.children || []).map((c: any) => (
              <div
                key={c.id}
                className={`${styles.tableRow} ${styles.folderRowHighlight} ${scopedFolderId === c.id ? styles.tableRowScoped : ""}`}
                onClick={() => { setSelectedFolder(c.id); setScopedFolder(c.id, c.name); }}
                title="进入子文件夹，自动限定检索范围">
                <span className={styles.colIcon}><Folder size={16} /></span>
                <span className={styles.colName}>{c.name}</span>
                <span className={styles.colType}>文件夹</span>
                <span className={styles.colSize}>—</span>
                <span className={`${styles.colStatus} ${styles.statusDone}`}>{docs.filter((d) => (d as any).folder_id === c.id).length} 文件</span>
                <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                  <button title="删除文件夹" onClick={async () => { if (!window.confirm(`删除 "${c.name}"？`)) return; await api.deleteFolder(id!, c.id); fetchAll(); toast.success("已删除"); }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {/* File rows */}
            {filteredDocs.length === 0 ? (
              <div className={styles.emptyRow}><FileText size={24} /><p>暂无文件，上传 PDF/Word/Markdown 开始</p></div>
            ) : filteredDocs.map((doc) => (
              <div key={doc.id}
                className={`${styles.tableRow} ${scopedDocId === doc.id ? styles.tableRowScoped : ""}`}
                onClick={() => {
                  if (scopedDocId === doc.id) {
                    setScopedDoc(null); // toggle off
                  } else {
                    setScopedDoc(doc.id, doc.filename);
                    setChatOpen(true);
                  }
                }}
                title={scopedDocId === doc.id ? "点击取消文件范围限定" : "点击限定检索此文件"}>
                <span className={styles.colIcon}>
                  <FileText size={16} />
                </span>
                <span className={styles.colName}>{doc.filename}</span>
                <span className={styles.colType}>{doc.file_type?.toUpperCase()}</span>
                <span className={styles.colSize}>{formatSize(doc.file_size)}</span>
                <span className={`${styles.colStatus} ${doc.parse_status === "completed" || doc.parse_status === "classified" ? styles.statusDone : styles.statusPending}`}>
                  {doc.parse_status === "completed" || doc.parse_status === "classified" ? "已完成" : doc.parse_status}
                </span>
                <div className={styles.rowActions}>
                  <div className={styles.moveWrap}>
                    <button onClick={(e) => { e.stopPropagation(); setMovingDocId(movingDocId === doc.id ? null : doc.id); }} title="移动到文件夹"><ArrowRightLeft size={13} /></button>
                    {movingDocId === doc.id && (
                      <div className={styles.moveDropdown} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.moveItem} onClick={async () => {
                          await api.updateDocument(doc.id, { folder_id: null });
                          setMovingDocId(null); fetchAll(); toast.success(`${doc.filename} → 根目录`);
                        }}><Folder size={12} /> 根目录（无文件夹）</button>
                        {folders.flatMap((f: any) => [
                          <button key={f.id} className={styles.moveItem} onClick={async () => {
                            await api.updateDocument(doc.id, { folder_id: f.id });
                            setMovingDocId(null); fetchAll(); toast.success(`${doc.filename} → ${f.name}`);
                          }}><Folder size={12} /> {f.name}</button>,
                          ...(f.children || []).map((c: any) => (
                            <button key={c.id} className={`${styles.moveItem} ${styles.moveItemChild}`} onClick={async () => {
                              await api.updateDocument(doc.id, { folder_id: c.id });
                              setMovingDocId(null); fetchAll(); toast.success(`${doc.filename} → ${c.name}`);
                            }}><Folder size={12} /> {c.name}</button>
                          ))
                        ])}
                      </div>
                    )}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handlePreview(doc); }} title="预览"><Eye size={13} /></button>
                  <button onClick={async (e) => { e.stopPropagation(); await deleteDocument(doc.id); fetchAll(); toast.success("已删除"); }} title="删除"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ section */}
          <div className={styles.faqSection}>
            <div className={styles.faqHeader}>
              <HelpCircle size={16} /> <strong>FAQ 问答管理</strong>
              <button onClick={() => setShowFAQForm(!showFAQForm)}><Plus size={14} /> 添加</button>
            </div>
            {showFAQForm && (
              <div className={styles.faqForm}>
                <input placeholder="问题" value={newQ} onChange={(e) => setNewQ(e.target.value)} />
                <textarea placeholder="答案" value={newA} onChange={(e) => setNewA(e.target.value)} rows={3} />
                <div><button onClick={handleAddFAQ}>保存</button><button onClick={() => setShowFAQForm(false)}>取消</button></div>
              </div>
            )}
            {faqItems.map((f: any) => (
              <details key={f.id} className={styles.faqItem}>
                <summary>{f.question} <button onClick={(e) => { e.preventDefault(); api.deleteFAQ(id!, f.id); fetchAll(); }}><X size={12} /></button></summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>

          {/* Recommended questions */}
          {kb?.recommended_questions?.length > 0 && (
            <div className={styles.recSection}>
              <strong>推荐问题</strong>
              <div className={styles.recList}>
                {(kb.recommended_questions as string[]).map((q) => (
                  <button key={q} onClick={() => handleRecQuestion(q)}>{q}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Chat panel with session management */}
        {chatOpen && (
        <div className={styles.chatPanel}>
          {/* Session header */}
          <div className={styles.chatHeader}>
            <div className={styles.sessionSelect} onClick={() => setSessionMenuOpen(!sessionMenuOpen)}>
              <Sparkles size={13} />
              <span className={styles.sessionTitle}>{currentSession?.title || "新对话"}</span>
              <ChevronDown size={10} className={sessionMenuOpen ? styles.chevronUp : ""} />
            </div>
            <div className={styles.sessionActions}>
              <button onClick={() => newSession()} title="新建会话"><MessageSquarePlus size={15} /></button>
              {currentSessionId && (
                <button onClick={() => { if (window.confirm("确定删除此会话？")) removeSession(currentSessionId); }}
                  title="删除会话"><Trash2 size={13} /></button>
              )}
            </div>
            {/* Session dropdown */}
            {sessionMenuOpen && (
              <div className={styles.sessionDropdown}>
                {sessions.length === 0 ? (
                  <div className={styles.sessionEmpty}>暂无会话</div>
                ) : sessions.map((s) => (
                  <button key={s.id}
                    className={`${styles.sessionItem} ${s.id === currentSessionId ? styles.sessionActive : ""}`}
                    onClick={() => { switchSession(s.id); setSessionMenuOpen(false); }}>
                    <span className={styles.sessionItemTitle}>{s.title}</span>
                    <span className={styles.sessionItemMeta}>{s.message_count} 条消息</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className={styles.chatScroll} onClick={() => setSessionMenuOpen(false)}>
            {messages.length === 0 && !isLoading && (
              <div className={styles.chatEmpty}><Sparkles size={24} /><p>基于当前知识库内容提问</p></div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === "user" ? styles.userMsg : styles.assistantMsg}>
                <div className={styles.msgBubble}>
                  {msg.role === "assistant" ? (
                    <div className={styles.markdownBody}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <details className={styles.msgSources}>
                      <summary>来源 ({msg.sources.length})</summary>
                      {msg.sources.map((s: any, i: number) => (
                        <div key={i} className={styles.sourceItem}>
                          <span className={styles.sourceDoc}>{s.document_name}</span>
                          <span>{Math.round(s.score * 100)}%</span>
                          <p>{s.content.slice(0, 150)}...</p>
                        </div>
                      ))}
                    </details>
                  )}
                  {/* Action buttons for assistant messages */}
                  {msg.role === "assistant" && (
                    <div className={styles.msgActions}>
                      <button
                        className={styles.msgActionBtn}
                        onClick={() => handleCopy(msg.content, msg.id)}
                        title="复制"
                      >
                        {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedId === msg.id ? "已复制" : "复制"}
                      </button>
                      <button
                        className={`${styles.msgActionBtn} ${msg.liked ? styles.likedBtn : ""}`}
                        onClick={() => toggleLikeMsg(msg.id)}
                        title="点赞"
                      >
                        <ThumbsUp size={13} fill={msg.liked ? "currentColor" : "none"} />
                        {msg.liked ? "已赞" : "点赞"}
                      </button>
                      {msg.id.length > 20 && (
                        <button className={styles.msgActionBtn} onClick={() => removeMessage(msg.id)} title="删除消息">
                          <X size={13} /> 删除
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Streaming token display */}
            {isLoading && streamingContent && (
              <div className={styles.assistantMsg}>
                <div className={styles.msgBubble}>
                  <div className={styles.markdownBody}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                  </div>
                  <span className={styles.cursor}>|</span>
                </div>
              </div>
            )}
            {isLoading && !streamingContent && (
              <div className={styles.assistantMsg}><div className={styles.msgBubble}><Loader2 size={16} className={styles.spin} /></div></div>
            )}
          </div>

          {/* Input */}
          <div className={styles.chatInput}>
            {scopedDocId && (
              <div className={styles.scopeBadge}>
                <FileText size={12} />
                <span className={styles.scopeBadgeLabel}>检索范围: {scopedDocName}</span>
                <button
                  className={styles.scopeBadgeClose}
                  onClick={() => setScopedDoc(null)}
                  title="取消文件范围限定">
                  <X size={11} />
                </button>
              </div>
            )}
            {scopedFolderId && (
              <div className={`${styles.scopeBadge} ${styles.scopeBadgeFolder}`}>
                <Folder size={12} />
                <span className={styles.scopeBadgeLabel}>检索范围: {scopedFolderName}</span>
                <button
                  className={styles.scopeBadgeClose}
                  onClick={() => setScopedFolder(null)}
                  title="取消文件夹范围限定">
                  <X size={11} />
                </button>
              </div>
            )}
            <textarea placeholder="向 AI 提问..." value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
              rows={2} disabled={isLoading} />
            <button onClick={handleChat} disabled={isLoading || !question.trim()}><Sparkles size={14} /></button>
          </div>
        </div>
        )}
      </div>

      {/* Upload dropdown — rendered at top level to avoid overflow clipping */}
      {uploadMenuOpen && (
        <div className={styles.overlay} onClick={() => setUploadMenuOpen(false)}>
          <div
            className={styles.dropdownMenu}
            style={{ position: "fixed", top: uploadMenuPos.top, left: uploadMenuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <label className={styles.dropdownItem}><File size={14} />文档 (.pdf .doc .xlsx...)<input type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.markdown,.pptx,.ppt,.html,.htm,.xml,.json,.log,.properties,.yaml,.yml,.toml,.ini,.cfg" onChange={(e) => { handleUpload(e); setUploadMenuOpen(false); }} /></label>
            <label className={styles.dropdownItem}><Image size={14} />图片 (.png .jpg .svg...)<input type="file" hidden accept=".png,.jpg,.jpeg,.gif,.bmp,.webp,.svg,.ico,.tiff,.tif,.heic" onChange={(e) => { handleUpload(e); setUploadMenuOpen(false); }} /></label>
            <label className={styles.dropdownItem}><Upload size={14} />音视频 (.mp3 .mp4...)<input type="file" hidden accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.avi,.mkv,.webm" onChange={(e) => { handleUpload(e); setUploadMenuOpen(false); }} /></label>
            <button className={styles.dropdownItem} onClick={() => { setShowUrlImport(true); setUploadMenuOpen(false); }}><Globe size={14} />网页链接</button>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {preview && (
        <div className={styles.overlay} onClick={() => setPreview(null)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewHeader}>
              <h3>{preview.filename}</h3>
              <button onClick={() => setPreview(null)}><X size={18} /></button>
            </div>
            <div className={styles.previewBody}>
              {preview.type === "pdf" ? (
                <p className={styles.previewPdfNote}>PDF 预览需要后端渲染支持，当前显示文本提取内容：</p>
              ) : null}
              <pre>{preview.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className={styles.overlay} onClick={() => setShowNewFolder(false)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
            <div className={styles.previewHeader}>
              <h3><FolderPlus size={16} /> 新建文件夹</h3>
              <button onClick={() => setShowNewFolder(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <input className={styles.importInput} placeholder="文件夹名称" value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)} autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddFolder()} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button className={styles.cancelBtn} onClick={() => setShowNewFolder(false)}>取消</button>
                <button className={styles.primaryBtn} onClick={handleAddFolder}>创建</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL Import Modal */}
      {showUrlImport && (
        <div className={styles.overlay} onClick={() => setShowUrlImport(false)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div className={styles.previewHeader}>
              <h3><Globe size={16} /> 导入网页</h3>
              <button onClick={() => setShowUrlImport(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <input className={styles.importInput} placeholder="网页链接 https://..." value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)} autoFocus />
              <input className={styles.importInput} placeholder="标题（可选）" value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)} style={{ marginTop: 10 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button className={styles.cancelBtn} onClick={() => setShowUrlImport(false)}>取消</button>
                <button className={styles.primaryBtn} onClick={handleUrlImport}
                  disabled={importing || !importUrl.trim()}>
                  {importing ? "导入中..." : "导入"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.status}>
        <span className={styles.statusDot} />
        {kb?.visibility === "shared" ? "共享" : "个人"} · 文档: {docs.length} · FAQ: {faqItems.length}
        {currentSession && ` · 会话: ${currentSession.title}`}
      </div>
    </div>
  );
}

function formatSize(b: number) { if (!b) return "0 B"; const u = ["B", "KB", "MB", "GB"]; const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1); return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`; }
