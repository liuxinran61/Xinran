// ===== Settings View — 系统配置页面 ======================================
//
// 四组表单：
//   1. LLM 大模型：API Base URL + 模型名称 + API Key（只读脱敏）
//   2. Embedding 嵌入：模型名称（只读，本地 sentence-transformers）
//   3. 文档分块：Chunk Size (128-4096) + Overlap (0-512)
//   4. RAG 检索：Top K (1-50) + 相似度阈值 (0-1)
//
// 配置加载：GET /api/admin/config → 失败则 fallback 到 DEFAULTS
// 保存：前端模拟（setTimeout 500ms），不请求后端
import { useState, useEffect } from "react";
import { getConfig } from "../../api/client";
import { Save, Zap } from "lucide-react";
import type { SystemConfig } from "../../types";
import styles from "./SettingsView.module.css";

const DEFAULTS: SystemConfig = {
  llm_api_base: "https://api.openai.com/v1",
  llm_model: "gpt-4o-mini",
  embedding_model: "BAAI/bge-large-zh-v1.5",
  chunk_size: 512,
  chunk_overlap: 50,
  rag_top_k: 5,
  rag_similarity_threshold: 0.5,
};

export function SettingsView() {
  const [config, setConfig] = useState<SystemConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getConfig()
      .then((c: SystemConfig) => setConfig(c))
      .catch(() => setConfig(DEFAULTS));
  }, []);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  const update = (key: keyof SystemConfig, value: string | number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>系统设置</h1>

      <div className={styles.form}>
        {/* ── LLM ── */}
        <div className={styles.group}>
          <h2 className={styles.groupTitle}>LLM 大模型</h2>
          <div className={styles.row}>
            <label>API Base URL</label>
            <input type="text" value={config.llm_api_base}
              onChange={(e) => update("llm_api_base", e.target.value)}
              placeholder="https://api.openai.com/v1" />
          </div>
          <div className={styles.row}>
            <label>模型</label>
            <input type="text" value={config.llm_model}
              onChange={(e) => update("llm_model", e.target.value)}
              placeholder="gpt-4o-mini" />
          </div>
          <div className={styles.row}>
            <label>API Key</label>
            <input type="password" value="sk-••••••••••••••••" readOnly />
            <span className={styles.hint}>修改 Key 请编辑 backend/.env 后重启</span>
          </div>
        </div>

        {/* ── Embedding ── */}
        <div className={styles.group}>
          <h2 className={styles.groupTitle}>Embedding 嵌入</h2>
          <div className={styles.row}>
            <label>模型</label>
            <input type="text" value={config.embedding_model} readOnly />
            <span className={styles.hint}>本地 sentence-transformers，通过 .env 切换</span>
          </div>
        </div>

        {/* ── 文档分块 ── */}
        <div className={styles.group}>
          <h2 className={styles.groupTitle}>文档分块</h2>
          <div className={styles.row}>
            <label>Chunk Size</label>
            <input type="number" value={config.chunk_size}
              onChange={(e) => update("chunk_size", Number(e.target.value))}
              min={128} max={4096} />
            <span className={styles.hint}>每块最大字符数</span>
          </div>
          <div className={styles.row}>
            <label>Overlap</label>
            <input type="number" value={config.chunk_overlap}
              onChange={(e) => update("chunk_overlap", Number(e.target.value))}
              min={0} max={512} />
            <span className={styles.hint}>相邻块重叠字符数</span>
          </div>
        </div>

        {/* ── RAG ── */}
        <div className={styles.group}>
          <h2 className={styles.groupTitle}>RAG 检索</h2>
          <div className={styles.row}>
            <label>Top K</label>
            <input type="number" value={config.rag_top_k}
              onChange={(e) => update("rag_top_k", Number(e.target.value))}
              min={1} max={50} />
            <span className={styles.hint}>每次检索返回的块数</span>
          </div>
          <div className={styles.row}>
            <label>相似度阈值</label>
            <input type="number" value={config.rag_similarity_threshold}
              onChange={(e) => update("rag_similarity_threshold", Number(e.target.value))}
              step={0.05} min={0} max={1} />
            <span className={styles.hint}>低于此值的结果被过滤</span>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          <Save size={14} />
          {saving ? "保存中..." : saved ? "✓ 已保存" : "保存设置"}
        </button>
        <span className={styles.status}>
          <Zap size={12} /> {config.llm_model}
        </span>
      </div>
    </div>
  );
}
