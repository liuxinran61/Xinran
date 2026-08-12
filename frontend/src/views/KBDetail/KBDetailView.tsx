// ===== KB Detail Page — 知识库详情页（唯一核心页面）=================================
//
// 页面结构（三区布局）：
//   顶栏：KB 名称 + 可见性标签 + 文档总数 + 已选计数 + 对话面板开关
//   主体：左侧文件浏览器（面包屑 + 文件夹/文件混排表格 + FAQ + 推荐问题）
//         右侧对话面板（会话管理 + Markdown 流式问答 + 范围限定标签）
//   底栏：状态条（可见性 · 文档数 · FAQ 数 · 当前会话）
//
// 文件交互系统：
//   单击 → 限定 RAG 检索范围到该文档/文件夹（行高亮 + 范围标签）
//   悬停 → Tooltip 元数据卡（跟随鼠标）
//   右键/双击 → 上下文菜单（重命名/标签/移动/复制/删除）
//   复选框 → 多选批量操作
//
// 数据轮询：每 5 秒自动刷新 KB 数据、文档列表、文件夹、FAQ
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Upload, Trash2, FolderPlus, Plus, Search, Sparkles, ChevronRight, ChevronDown,
  FileText, Folder, HelpCircle, X, Loader2, Eye, Globe, Image, File, MessageSquarePlus,
  Copy, ThumbsUp, Check, PanelRightClose, PanelRightOpen, Square, CheckSquare,
  Pencil, Tag, ClipboardCopy, GripVertical, ArrowRightLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listDocuments, uploadDocument, deleteDocument } from "../../api/client";
import { useChatStore } from "../../stores/chatStore";
import { useToastStore } from "../../stores/toastStore";
import type { Document, KnowledgeBase } from "../../types";
import styles from "./KBDetailView.module.css";

const API_BASE = "http://localhost:8004";

// ── 内联 API 封装（fetch 直连，不经过 axios client）─────
// KBDetailView 中大部分写操作通过原生 fetch 实现，读操作复用 api/client.ts
const api = {
  getKB: async (id: string) => { const r = await fetch(`${API_BASE}/api/knowledge-bases/${id}`); return r.json(); },
  getFolders: async (id: string) => { const r = await fetch(`${API_BASE}/api/knowledge-bases/${id}/folders`); return r.json(); },
  createFolder: async (id: string, name: string, parentId?: string) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}/folders`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name,parent_id:parentId||null}) }); },
  deleteFolder: async (id: string, fid: string) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}/folders/${fid}`, { method:"DELETE" }); },
  updateDocument: async (docId: string, data: { folder_id?: string | null; filename?: string; tags?: string[]; description?: string | null }) => { const r = await fetch(`${API_BASE}/api/documents/${docId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }); return r.json(); },
  copyDocument: async (docId: string, targetFolderId?: string | null) => { const params = targetFolderId ? `?target_folder_id=${targetFolderId}` : ""; const r = await fetch(`${API_BASE}/api/documents/${docId}/copy${params}`, { method:"POST" }); return r.json(); },
  getFAQ: async (id: string) => { const r = await fetch(`${API_BASE}/api/knowledge-bases/${id}/faq`); return r.json(); },
  createFAQ: async (id: string, q: string, a: string) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}/faq`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({question:q,answer:a}) }); },
  deleteFAQ: async (id: string, fid: string) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}/faq/${fid}`, { method:"DELETE" }); },
  updateKB: async (id: string, data: Record<string, unknown>) => { await fetch(`${API_BASE}/api/knowledge-bases/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }); },
  getDocContent: async (id: string) => { const r = await fetch(`${API_BASE}/api/documents/${id}`); return r.json(); },
};

// ======================================================================
// KBDetailView — 知识库详情页主组件
// 负责：文件浏览、对话问答、文件管理操作（重命名/标签/移动/删除）
// ======================================================================
export function KBDetailView() {
  const { id } = useParams<{ id: string }>();

  // ── 核心数据状态 ──────────────────────────────────────
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
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);

  // ── 选择系统 ──────────────────────────────────────────
  // 复选框多选 + 右键上下文菜单 + 悬停元数据提示
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number;
    ids: string[];
    targetType: 'file' | 'folder';
    targetName: string;
  } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ doc: any; x: number; y: number } | null>(null);
  const [renameModal, setRenameModal] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [tagModal, setTagModal] = useState<{ id: string; name: string; tags: string[] } | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [batchMoveTarget, setBatchMoveTarget] = useState<{ ids: string[]; mode: 'move' | 'copy' } | null>(null);

  const toast = useToastStore();
  const {
    sessions, currentSessionId, messages, isLoading, streamingContent,
    setKbId, newSession, switchSession, removeSession,
    sendMessage, removeMessage, toggleLikeMsg,
    scopedDocId, scopedDocName, setScopedDoc,
    scopedFolderId, scopedFolderName, setScopedFolder,
  } = useChatStore();

  // ── 数据获取 & 5 秒轮询 ─────────────────────────────
  // 并行拉取 KB 信息、文档、文件夹、FAQ 四项数据
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
    setQuestion("");
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

  // ── Selection helpers ──
  const toggleSelect = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = new Set([
      ...folders.filter((f: any) => !selectedFolder).map((f: any) => f.id),
      ...(selectedFolder ? (folders.find((x: any) => x.id === selectedFolder)?.children || []).map((c: any) => c.id) : []),
      ...filteredDocs.map((d: any) => d.id),
    ]);
    if (selectedIds.size === allIds.size && allIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(allIds);
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Context menu ──
  const showContextMenu = (e: React.MouseEvent, itemIds: string[], targetType: 'file' | 'folder', targetName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, ids: itemIds, targetType, targetName });
  };

  const closeContextMenu = () => setContextMenu(null);

  // 点击页面任意位置关闭上下文菜单
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => closeContextMenu();
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [contextMenu]);

  // ── Row click handler (scoping) ──
  const handleFileRowClick = (doc: any, e: React.MouseEvent) => {
    // If clicking on checkbox, don't scope
    if ((e.target as HTMLElement).closest(`.${styles.colCheck}`)) return;
    if (scopedDocId === doc.id) {
      setScopedDoc(null);
    } else {
      setScopedDoc(doc.id, doc.filename);
      setChatOpen(true);
    }
  };

  const handleFolderRowClick = (f: any) => {
    setSelectedFolder(f.id);
    setScopedFolder(f.id, f.name);
    clearSelection();
  };

  // ── Context menu actions ──
  const handleRename = (itemId: string, name: string, type: 'file' | 'folder') => {
    setRenameModal({ id: itemId, name, type });
    closeContextMenu();
  };

  const handleEditTags = (doc: any) => {
    setTagModal({ id: doc.id, name: doc.filename, tags: doc.tags || [] });
    closeContextMenu();
  };

  const handleMoveTo = (itemId: string, type: 'file' | 'folder') => {
    if (type === 'file') {
      setBatchMoveTarget({ ids: [itemId], mode: 'move' });
    }
    closeContextMenu();
  };

  const handleCopyTo = (itemId: string, type: 'file' | 'folder') => {
    if (type === 'file') {
      setBatchMoveTarget({ ids: [itemId], mode: 'copy' });
    }
    closeContextMenu();
  };

  const handleDeleteItem = async (itemId: string, type: 'file' | 'folder', name: string) => {
    if (!window.confirm(`确定删除 "${name}"？${type === 'folder' ? '其中的文件不会被删除。' : ''}`)) return;
    if (type === 'folder') {
      await api.deleteFolder(id!, itemId);
    } else {
      await deleteDocument(itemId);
    }
    fetchAll();
    toast.success(`已删除 "${name}"`);
    closeContextMenu();
  };

  // ── Batch operations ──
  const handleBatchDelete = async () => {
    const ids = contextMenu?.ids || [];
    if (ids.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${ids.length} 个项目？`)) return;
    for (const itemId of ids) {
      try {
        // Check if it's a folder (folders are in the folders array)
        const isFolder = folders.some((f: any) => f.id === itemId) ||
          folders.some((f: any) => (f.children || []).some((c: any) => c.id === itemId));
        if (isFolder) {
          await api.deleteFolder(id!, itemId);
        } else {
          await deleteDocument(itemId);
        }
      } catch { /* continue */ }
    }
    setSelectedIds(new Set());
    fetchAll();
    toast.success(`已删除 ${ids.length} 个项目`);
    closeContextMenu();
  };

  const handleBatchMove = () => {
    const ids = contextMenu?.ids || [];
    if (ids.length === 0) return;
    setBatchMoveTarget({ ids, mode: 'move' });
    closeContextMenu();
  };

  const handleBatchCopy = () => {
    const ids = contextMenu?.ids || [];
    if (ids.length === 0) return;
    setBatchMoveTarget({ ids, mode: 'copy' });
    closeContextMenu();
  };

  const executeBatchTarget = async (targetFolderId: string | null) => {
    if (!batchMoveTarget) return;
    const { ids, mode } = batchMoveTarget;
    const folderLabel = targetFolderId ? getFolderName(targetFolderId) : "根目录";

    for (const docId of ids) {
      try {
        if (mode === 'move') {
          await api.updateDocument(docId, { folder_id: targetFolderId });
        } else {
          await api.copyDocument(docId, targetFolderId);
        }
      } catch { /* continue */ }
    }
    setBatchMoveTarget(null);
    setSelectedIds(new Set());
    fetchAll();
    toast.success(`${mode === 'move' ? '移动' : '复制'} ${ids.length} 个文件 → ${folderLabel}`);
  };

  // ── Rename submit ──
  const handleRenameSubmit = async () => {
    if (!renameModal || !renameModal.name.trim()) return;
    const { id: itemId, name, type } = renameModal;
    if (type === 'file') {
      await api.updateDocument(itemId, { filename: name });
    } else {
      // Rename folder: we could add a backend endpoint, but for now use a simple approach
      await fetch(`${API_BASE}/api/knowledge-bases/${id}/folders/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }
    setRenameModal(null);
    fetchAll();
    toast.success(`已重命名为 "${name}"`);
  };

  // ── Tag submit ──
  const handleTagSubmit = async () => {
    if (!tagModal) return;
    await api.updateDocument(tagModal.id, { tags: tagModal.tags });
    setTagModal(null);
    fetchAll();
    toast.success("标签已更新");
  };

  const addTag = () => {
    if (!tagInput.trim() || !tagModal) return;
    if (tagModal.tags.includes(tagInput.trim())) { setTagInput(""); return; }
    setTagModal({ ...tagModal, tags: [...tagModal.tags, tagInput.trim()] });
    setTagInput("");
  };

  const removeTag = (t: string) => {
    if (!tagModal) return;
    setTagModal({ ...tagModal, tags: tagModal.tags.filter(x => x !== t) });
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

  // ── Build all flat folders for the move/copy dropdown ──
  const allFlatFolders = folders.flatMap((f: any) => [
    { id: f.id, name: f.name, depth: 0 },
    ...(f.children || []).map((c: any) => ({ id: c.id, name: c.name, depth: 1 })),
  ]);

  // ── Get tooltip description from classification ──
  const getTooltipDesc = (doc: any) => {
    const cls = doc.classification;
    if (cls && cls.scenario) {
      return `${cls.scenario}${cls.category ? ` · ${cls.category}` : ''}${cls.severity ? ` · ${cls.severity}` : ''}`;
    }
    return null;
  };

  // ================================================================
  // RENDER — 三区布局：顶栏 | 主体(文件区 + 对话面板) | 底栏
  // ================================================================
  return (
    <div className={styles.center}>
      {/* ── 顶栏：KB 名称 + 已选计数 + 文档总数 + 对话开关 ── */}
      <div className={styles.topbar}>
        <h2>{kb?.name || "加载中..."}</h2>
        <span className={styles.kbBadge}>{kb?.visibility === "shared" ? "共享知识库" : "个人知识库"}</span>
        <div className={styles.topActions}>
          {selectedIds.size > 0 && (
            <span className={styles.selectionCount}>已选 {selectedIds.size} 项 · <button onClick={clearSelection}>取消</button></span>
          )}
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

        {/* ── 主体：左侧文件区 + 右侧对话面板 ── */}
        <div className={styles.body}>
          {/* ===== 左侧文件区域 ===== */}
          <div className={styles.mainArea}>
            {/* 面包屑导航 */}
          <div className={styles.breadcrumb}>
            <button
              className={`${styles.breadcrumbItem} ${!selectedFolder ? styles.breadcrumbActive : ""}`}
              onClick={() => { setSelectedFolder(null); setScopedFolder(null); clearSelection(); }}>
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

          {/* ===== 文件夹 + 文件混排表格 =====
               7 列精确 Grid: 复选框 32px | 图标 28px | 名称 1fr | 类型 70px | 大小 60px | 状态 80px | 操作 100px */}
          <div className={styles.tableCard}>
            {/* Table header — select all */}
            <div className={`${styles.tableRow} ${styles.tableHeader}`}>
              <span className={styles.colCheck} onClick={toggleSelectAll} title="全选/取消">
                {selectedIds.size > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
              </span>
              <span className={styles.colIcon}></span>
              <span className={styles.colName}>名称</span>
              <span className={styles.colType}>类型</span>
              <span className={styles.colSize}>大小</span>
              <span className={styles.colStatus}>状态</span>
              <span className={styles.colActions}></span>
            </div>

            {/* Root-level folders */}
            {!selectedFolder && folders.map((f: any) => {
              const isSelected = selectedIds.has(f.id);
              return (
                <div
                  key={f.id}
                  className={`${styles.tableRow} ${styles.folderRowHighlight} ${scopedFolderId === f.id ? styles.tableRowScoped : ""} ${isSelected ? styles.rowSelected : ""}`}
                  onClick={() => handleFolderRowClick(f)}
                  onDoubleClick={(e) => showContextMenu(e, isSelected ? Array.from(selectedIds) : [f.id], 'folder', f.name)}
                  onContextMenu={(e) => showContextMenu(e, isSelected ? Array.from(selectedIds) : [f.id], 'folder', f.name)}
                >
                  <span className={styles.colCheck} onClick={(e) => toggleSelect(f.id, e)}>
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                  <span className={styles.colIcon}><Folder size={16} /></span>
                  <span className={styles.colName}>{f.name}</span>
                  <span className={styles.colType}>文件夹</span>
                  <span className={styles.colSize}>{f.children?.length || 0} 子目录</span>
                  <span className={`${styles.colStatus} ${styles.statusDone}`}>{docs.filter((d) => (d as any).folder_id === f.id).length} 文件</span>
                  <span className={styles.colActions}></span>
                </div>
              );
            })}

            {/* Sub-folders when inside a parent folder */}
            {selectedFolder && (folders.find((x: any) => x.id === selectedFolder)?.children || []).map((c: any) => {
              const isSelected = selectedIds.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`${styles.tableRow} ${styles.folderRowHighlight} ${scopedFolderId === c.id ? styles.tableRowScoped : ""} ${isSelected ? styles.rowSelected : ""}`}
                  onClick={() => handleFolderRowClick(c)}
                  onDoubleClick={(e) => showContextMenu(e, isSelected ? Array.from(selectedIds) : [c.id], 'folder', c.name)}
                  onContextMenu={(e) => showContextMenu(e, isSelected ? Array.from(selectedIds) : [c.id], 'folder', c.name)}
                >
                  <span className={styles.colCheck} onClick={(e) => toggleSelect(c.id, e)}>
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                  <span className={styles.colIcon}><Folder size={16} /></span>
                  <span className={styles.colName}>{c.name}</span>
                  <span className={styles.colType}>文件夹</span>
                  <span className={styles.colSize}>—</span>
                  <span className={`${styles.colStatus} ${styles.statusDone}`}>{docs.filter((d) => (d as any).folder_id === c.id).length} 文件</span>
                  <span className={styles.colActions}></span>
                </div>
              );
            })}

            {/* File rows */}
            {filteredDocs.length === 0 ? (
              <div className={styles.emptyRow}><FileText size={24} /><p>暂无文件，上传 PDF/Word/Markdown 开始</p></div>
            ) : filteredDocs.map((doc: any) => {
              const isSelected = selectedIds.has(doc.id);
              const tooltipDesc = getTooltipDesc(doc);
              return (
                <div key={doc.id}
                  className={`${styles.tableRow} ${scopedDocId === doc.id ? styles.tableRowScoped : ""} ${isSelected ? styles.rowSelected : ""}`}
                  onClick={(e) => handleFileRowClick(doc, e)}
                  onDoubleClick={(e) => showContextMenu(e, isSelected ? Array.from(selectedIds) : [doc.id], 'file', doc.filename)}
                  onContextMenu={(e) => showContextMenu(e, isSelected ? Array.from(selectedIds) : [doc.id], 'file', doc.filename)}
                  onMouseEnter={(e) => setHoverInfo({ doc, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHoverInfo(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                  onMouseLeave={() => setHoverInfo(null)}
                >
                  <span className={styles.colCheck} onClick={(e) => toggleSelect(doc.id, e)}>
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                  <span className={styles.colIcon}>
                    <FileText size={16} />
                  </span>
                  <span className={styles.colName}>{doc.filename}</span>
                  <span className={styles.colType}>{doc.file_type?.toUpperCase()}</span>
                  <span className={styles.colSize}>{formatSize(doc.file_size)}</span>
                  <span className={`${styles.colStatus} ${doc.parse_status === "completed" || doc.parse_status === "classified" ? styles.statusDone : styles.statusPending}`}>
                    {doc.parse_status === "completed" || doc.parse_status === "classified" ? "已完成" : doc.parse_status}
                  </span>
                  <span className={styles.colActions}>
                    {/* Tag indicators */}
                    {(doc.tags || []).length > 0 && (
                      <span className={styles.tagDots}>
                        {(doc.tags as string[]).slice(0, 3).map((t: string, i: number) => (
                          <span key={i} className={styles.tagDot} title={t}>{t}</span>
                        ))}
                        {doc.tags.length > 3 && <span className={styles.tagMore}>+{doc.tags.length - 3}</span>}
                      </span>
                    )}
                    <button className={styles.previewBtn} onClick={(e) => { e.stopPropagation(); handlePreview(doc); }} title="预览">
                      <Eye size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>

            {/* ===== FAQ 问答管理 ===== */}
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

          {/* ===== 推荐问题 ===== */}
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

        {/* ===== 右侧：RAG 对话面板 =====
             包含会话管理、SSE 流式回复、Markdown 渲染、来源引用、复制/点赞/删除 */}
        {chatOpen && (
          <div className={styles.chatPanel}>
          {/* ... (chat panel unchanged) ... */}
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
                  {msg.role === "assistant" && (
                    <div className={styles.msgActions}>
                      <button className={styles.msgActionBtn} onClick={() => handleCopy(msg.content, msg.id)} title="复制">
                        {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedId === msg.id ? "已复制" : "复制"}
                      </button>
                      <button
                        className={`${styles.msgActionBtn} ${msg.liked ? styles.likedBtn : ""}`}
                        onClick={() => toggleLikeMsg(msg.id)} title="点赞">
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
                <button className={styles.scopeBadgeClose} onClick={() => setScopedDoc(null)} title="取消文件范围限定">
                  <X size={11} />
                </button>
              </div>
            )}
            {scopedFolderId && (
              <div className={`${styles.scopeBadge} ${styles.scopeBadgeFolder}`}>
                <Folder size={12} />
                <span className={styles.scopeBadgeLabel}>检索范围: {scopedFolderName}</span>
                <button className={styles.scopeBadgeClose} onClick={() => setScopedFolder(null)} title="取消文件夹范围限定">
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

      {/* ===== 弹层：悬停元数据提示 ===== */}
      {hoverInfo && (
        <div
          className={styles.hoverTooltip}
          style={{ position: "fixed", top: hoverInfo.y + 16, left: hoverInfo.x + 12, zIndex: 300 }}
        >
          <div className={styles.tooltipTitle}>{hoverInfo.doc.filename}</div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>类型</span>
            <span>{hoverInfo.doc.file_type?.toUpperCase()}</span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>大小</span>
            <span>{formatSize(hoverInfo.doc.file_size)}</span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>上传时间</span>
            <span>{new Date(hoverInfo.doc.created_at).toLocaleString("zh-CN")}</span>
          </div>
          {hoverInfo.doc.parse_status && (
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>状态</span>
              <span className={styles.statusDone}>
                {hoverInfo.doc.parse_status === "completed" || hoverInfo.doc.parse_status === "classified" ? "已完成" : hoverInfo.doc.parse_status}
              </span>
            </div>
          )}
          {getTooltipDesc(hoverInfo.doc) && (
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>分类</span>
              <span>{getTooltipDesc(hoverInfo.doc)}</span>
            </div>
          )}
          {(hoverInfo.doc.tags || []).length > 0 && (
            <div className={styles.tooltipTags}>
              {(hoverInfo.doc.tags as string[]).map((t: string, i: number) => (
                <span key={i} className={styles.tooltipTag}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== 弹层：右键上下文菜单 ===== */}
      {contextMenu && (
        <div className={styles.overlay} onClick={closeContextMenu} style={{ background: "transparent", zIndex: 250 }}>
          <div
            className={styles.contextMenu}
            style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 251 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.contextMenuHeader}>
              {contextMenu.ids.length > 1
                ? `已选 ${contextMenu.ids.length} 项`
                : contextMenu.targetName}
            </div>
            {contextMenu.ids.length === 1 && contextMenu.targetType === 'file' && (
              <>
                <button className={styles.contextMenuItem} onClick={() => handleRename(contextMenu.ids[0], contextMenu.targetName, 'file')}>
                  <Pencil size={13} /> 重命名
                </button>
                <button className={styles.contextMenuItem} onClick={() => {
                  const doc = docs.find((d: any) => d.id === contextMenu.ids[0]);
                  if (doc) handleEditTags(doc);
                }}>
                  <Tag size={13} /> 编辑标签
                </button>
                <div className={styles.contextMenuSep} />
                <button className={styles.contextMenuItem} onClick={() => handleMoveTo(contextMenu.ids[0], 'file')}>
                  <ArrowRightLeft size={13} /> 移动到
                </button>
                <button className={styles.contextMenuItem} onClick={() => handleCopyTo(contextMenu.ids[0], 'file')}>
                  <ClipboardCopy size={13} /> 复制到
                </button>
              </>
            )}
            {contextMenu.ids.length === 1 && contextMenu.targetType === 'folder' && (
              <>
                <button className={styles.contextMenuItem} onClick={() => handleRename(contextMenu.ids[0], contextMenu.targetName, 'folder')}>
                  <Pencil size={13} /> 重命名
                </button>
              </>
            )}
            {contextMenu.ids.length > 1 && (
              <>
                <button className={styles.contextMenuItem} onClick={handleBatchMove}>
                  <ArrowRightLeft size={13} /> 移动到
                </button>
                <button className={styles.contextMenuItem} onClick={handleBatchCopy}>
                  <ClipboardCopy size={13} /> 复制到
                </button>
              </>
            )}
            <div className={styles.contextMenuSep} />
            <button className={`${styles.contextMenuItem} ${styles.contextMenuDanger}`}
              onClick={() => {
                if (contextMenu.ids.length > 1) {
                  handleBatchDelete();
                } else {
                  handleDeleteItem(contextMenu.ids[0], contextMenu.targetType, contextMenu.targetName);
                }
              }}>
              <Trash2 size={13} /> 删除
            </button>
          </div>
        </div>
      )}

      {/* ===== 弹层：批量 移动/复制 目标文件夹选择器 ===== */}
      {batchMoveTarget && (
        <div className={styles.overlay} onClick={() => setBatchMoveTarget(null)} style={{ background: "transparent", zIndex: 250 }}>
          <div
            className={styles.contextMenu}
            style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 251, minWidth: 200 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.contextMenuHeader}>
              {batchMoveTarget.mode === 'move' ? '移动到' : '复制到'} ({batchMoveTarget.ids.length} 项)
            </div>
            <button className={styles.contextMenuItem} onClick={() => executeBatchTarget(null)}>
              <Folder size={13} /> 根目录（无文件夹）
            </button>
            {allFlatFolders.map((f) => (
              <button key={f.id} className={styles.contextMenuItem} style={{ paddingLeft: 16 + f.depth * 14 }}
                onClick={() => executeBatchTarget(f.id)}>
                <Folder size={13} /> {f.name}
              </button>
            ))}
            <div className={styles.contextMenuSep} />
            <button className={styles.contextMenuItem} onClick={() => setBatchMoveTarget(null)}>
              <X size={13} /> 取消
            </button>
          </div>
        </div>
      )}

      {/* ===== 弹层：重命名 ===== */}
      {renameModal && (
        <div className={styles.overlay} onClick={() => setRenameModal(null)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
            <div className={styles.previewHeader}>
              <h3><Pencil size={16} /> 重命名</h3>
              <button onClick={() => setRenameModal(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <input className={styles.importInput} placeholder="新名称" value={renameModal.name}
                onChange={(e) => setRenameModal({ ...renameModal, name: e.target.value })} autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button className={styles.cancelBtn} onClick={() => setRenameModal(null)}>取消</button>
                <button className={styles.primaryBtn} onClick={handleRenameSubmit}>确定</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 弹层：编辑标签 ===== */}
      {tagModal && (
        <div className={styles.overlay} onClick={() => { setTagModal(null); handleTagSubmit(); }}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div className={styles.previewHeader}>
              <h3><Tag size={16} /> 编辑标签 — {tagModal.name}</h3>
              <button onClick={() => { setTagModal(null); handleTagSubmit(); }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className={styles.tagList}>
                {tagModal.tags.map((t) => (
                  <span key={t} className={styles.tagChip}>
                    {t}
                    <button onClick={() => removeTag(t)}><X size={11} /></button>
                  </span>
                ))}
                {tagModal.tags.length === 0 && <span className={styles.tagEmpty}>暂无标签，添加一些吧</span>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input className={styles.importInput} placeholder="输入标签后按回车添加" value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  autoFocus />
                <button className={styles.primaryBtn} onClick={addTag}>添加</button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button className={styles.cancelBtn} onClick={() => { setTagModal(null); handleTagSubmit(); }}>取消</button>
                <button className={styles.primaryBtn} onClick={handleTagSubmit}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 弹层：上传文件下拉菜单（文档/图片/音视频/网页链接）===== */}
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

      {/* ===== 弹层：文件预览 ===== */}
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

      {/* ===== 弹层：新建文件夹 ===== */}
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

      {/* ===== 弹层：导入网页链接 ===== */}
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
