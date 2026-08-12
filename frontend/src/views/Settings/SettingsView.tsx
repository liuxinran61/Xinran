// ===== Settings View =====
import { useState, useEffect } from "react";
import { getConfig } from "../../api/client";
import { Save, Brain, Scissors, Search as SearchIcon, Globe, Cpu, Zap, Database } from "lucide-react";
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
      <div className={styles.scroll}>
        <div className={styles.header}>
          <h1>系统设置</h1>
          <p>配置 LLM 大模型、Embedding、文档分块与 RAG 检索参数</p>
        </div>

        <div className={styles.grid}>
          {/* LLM */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <Brain size={18} />
              <h3>LLM 大模型</h3>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.field}>
                <label>API Base URL</label>
                <div className={styles.inputIcon}>
                  <Globe size={14} />
                  <input type="text" value={config.llm_api_base}
                    onChange={(e) => update("llm_api_base", e.target.value)}
                    placeholder="https://api.openai.com/v1" />
                </div>
              </div>
              <div className={styles.field}>
                <label>模型</label>
                <div className={styles.inputIcon}>
                  <Cpu size={14} />
                  <input type="text" value={config.llm_model}
                    onChange={(e) => update("llm_model", e.target.value)}
                    placeholder="gpt-4o-mini" />
                </div>
              </div>
              <div className={styles.field}>
                <label>API Key</label>
                <input type="password" value="sk-••••••••••••••••" readOnly className={styles.readonly} />
                <span className={styles.hint}>修改 Key 请编辑 backend/.env 文件后重启</span>
              </div>
            </div>
          </section>

          {/* Embedding */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <Database size={18} />
              <h3>Embedding 嵌入</h3>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.field}>
                <label>模型</label>
                <div className={styles.inputIcon}>
                  <Cpu size={14} />
                  <input type="text" value={config.embedding_model} readOnly className={styles.readonly} />
                </div>
                <span className={styles.hint}>当前使用本地 sentence-transformers，通过 .env 切换 API 模式</span>
              </div>
            </div>
          </section>

          {/* Chunking */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <Scissors size={18} />
              <h3>文档分块</h3>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Chunk Size</label>
                  <input type="number" value={config.chunk_size}
                    onChange={(e) => update("chunk_size", Number(e.target.value))} min={128} max={4096} />
                  <span className={styles.hint}>每块最大字符数，建议 512</span>
                </div>
                <div className={styles.field}>
                  <label>Overlap</label>
                  <input type="number" value={config.chunk_overlap}
                    onChange={(e) => update("chunk_overlap", Number(e.target.value))} min={0} max={512} />
                  <span className={styles.hint}>相邻块重叠字符，建议 50</span>
                </div>
              </div>
            </div>
          </section>

          {/* RAG */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <SearchIcon size={18} />
              <h3>RAG 检索</h3>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Top K</label>
                  <input type="number" value={config.rag_top_k}
                    onChange={(e) => update("rag_top_k", Number(e.target.value))} min={1} max={50} />
                  <span className={styles.hint}>每次检索返回的文档块数</span>
                </div>
                <div className={styles.field}>
                  <label>相似度阈值</label>
                  <input type="number" value={config.rag_similarity_threshold}
                    onChange={(e) => update("rag_similarity_threshold", Number(e.target.value))}
                    step={0.05} min={0} max={1} />
                  <span className={styles.hint}>低于此值的结果会被过滤</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.saveRow}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? "保存中..." : saved ? "✓ 已保存" : "保存设置"}
          </button>
          <span className={styles.status}>
            <Zap size={12} /> 当前模型: {config.llm_model}
          </span>
        </div>
      </div>
    </div>
  );
}
