// ===== Sidebar — 侧边导航栏（220px 固定宽度）================================
//
// 结构（从上到下）：
//   1. 品牌 Logo（双菱形 CSS 绘制）+ "Knowledge OS" 标题
//   2. 个人知识库分组（折叠手风琴 + + 创建按钮）
//   3. 共享知识库分组（同上）
//   4. 分割线
//   5. 知识图谱入口（GitFork 图标）
//   6. 设置入口（Settings 图标）
//
// 交互：
//   - KB 分组可折叠/展开（ChevronRight 旋转动画）
//   - 新建 KB 用浏览器 prompt() 输入名称
//   - 活跃 KB 项有紫色左边框 + 浅色背景
//   - 响应式：≤1180px 折叠为 56px 纯图标模式
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import clsx from "clsx";
import { BookOpen, Plus, ChevronRight, GitFork, Settings, User, Users } from "lucide-react";
import { listKBs, createKB } from "../../api/client";
import type { KnowledgeBase } from "../../types";
import { useUIStore } from "../../stores/uiStore";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [expanded, setExpanded] = useState<{ personal: boolean; shared: boolean }>({
    personal: true, shared: true,
  });

  const fetch = () => { listKBs().then(setKbs).catch(() => {}); };
  useEffect(() => { fetch(); }, [location.pathname]);

  const personal = kbs.filter((k) => k.visibility !== "shared");
  const shared = kbs.filter((k) => k.visibility === "shared");

  const toggleSection = (key: "personal" | "shared") => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreate = async (vis: string) => {
    const name = prompt(vis === "shared" ? "共享知识库名称:" : "个人知识库名称:");
    if (!name) return;
    await createKB({ name, visibility: vis, join_mode: vis === "shared" ? "approval" : "direct" });
    fetch();
  };

  const renderSection = (title: string, items: KnowledgeBase[], key: "personal" | "shared", Icon: typeof User) => (
    <div className={styles.section}>
      <button className={styles.sectionToggle} onClick={() => toggleSection(key)}>
        <ChevronRight size={12} className={clsx(styles.chevron, expanded[key] && styles.chevronOpen)} />
        <Icon size={14} />
        <span className={styles.navLabel}>{title}</span>
        <span className={styles.sectionCount}>{items.length}</span>
        <button className={styles.addBtn} onClick={(e) => { e.stopPropagation(); handleCreate(key); }}>
          <Plus size={14} />
        </button>
      </button>
      {expanded[key] && (
        <nav className={styles.nav}>
          {items.length === 0 ? (
            <div className={styles.emptyHint}>暂无知识库</div>
          ) : items.map((kb) => (
            <button
              key={kb.id}
              className={clsx(styles.navItem, location.pathname === `/kb/${kb.id}` && styles.navItemActive)}
              onClick={() => { setActiveView("kb"); navigate(`/kb/${kb.id}`); }}
            >
              <BookOpen size={18} />
              <span className={styles.navTitle}>{kb.name}</span>
              <span className={styles.navCount}>{kb.document_count}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <span className={clsx(styles.diamond, styles.diamondA)} />
          <span className={clsx(styles.diamond, styles.diamondB)} />
        </div>
        <div className={styles.brandText}>
          <div className={styles.brandTitle}>Knowledge OS</div>
        </div>
      </div>

      {/* Personal KBs */}
      {renderSection("个人知识库", personal, "personal", User)}

      {/* Shared KBs */}
      {renderSection("共享知识库", shared, "shared", Users)}

      <div className={styles.divider} />

      {/* Graph */}
      <button
        className={clsx(styles.navItem, location.pathname === "/graph" && styles.navItemActive)}
        onClick={() => { setActiveView("graph"); navigate("/graph"); }}
      >
        <GitFork size={18} />
        <span className={styles.navTitle}>知识图谱</span>
      </button>

      {/* Settings */}
      <button
        className={clsx(styles.navItem, location.pathname === "/settings" && styles.navItemActive)}
        onClick={() => { setActiveView("settings"); navigate("/settings"); }}
      >
        <Settings size={18} />
        <span className={styles.navTitle}>设置</span>
      </button>
    </aside>
  );
}
