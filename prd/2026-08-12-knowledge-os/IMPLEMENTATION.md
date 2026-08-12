# IMPLEMENTATION.md — Knowledge OS 全栈知识库系统

> 按构建顺序排列（`impl_order`），依赖项优先。每节内容可直接交付开发人员作为实现参考。

---

## C1 — 应用壳层与三列布局导航            [构建: 无依赖]

```text
Goal: 构建全站统一的 AppLayout 三列布局壳层 + Sidebar 侧边导航 + 全局 Operator 占位。

Design decisions to preserve:
- 三列 CSS Grid 使用精确像素值：220px 1fr 360px（侧边栏 | 内容 | Operator），不是 flexbox
- 响应式断点在 AppLayout 中用 useEffect + resize 事件实现，断点存入 Zustand uiStore
- Sidebar 不使用路由库的 NavLink，而是用 location.pathname 手动匹配高亮
- 品牌 Logo 用两个 CSS 绘制的 span 旋转 45° 菱形叠加，不用图片
- KB 列表分组逻辑：visibility !== "shared" = 个人，visibility === "shared" = 共享
- 新建 KB 用浏览器 prompt()，简单直接
- 所有 KB 数据在路由变化时重新 fetch（依赖 location.pathname）

Where the reference implementation is:
- frontend/src/components/Layout/AppLayout.tsx + AppLayout.module.css
- frontend/src/components/Layout/Sidebar.tsx + Sidebar.module.css
- frontend/src/stores/uiStore.ts
- frontend/src/App.tsx（路由表结构）

Key snippets:
- Grid 模板: .app { grid-template-columns: 220px 1fr 360px }
- 折叠变体: .sidebarCollapsed → 56px 1fr 360px; .operatorCollapsed → 220px 1fr 44px
- 响应式断点: >1180 desktop, >930 tablet, >760 mobile, ≤760 phone
- 侧边栏图标来自 lucide-react (BookOpen, Plus, ChevronRight, GitFork, Settings, User, Users)

Acceptance:
- [ ] AppLayout 同时渲染 Sidebar + Outlet + Operator
- [ ] Sidebar 中 KB 分组可折叠/展开（ChevronRight 旋转动画）
- [ ] 活跃 KB 项有蓝色左边框 (#3370ff) + 浅色背景
- [ ] 平板断点（930-1180px）侧边栏自动收折为 56px
```

---

## C2 — KB 详情 — 文件浏览器（文件夹导航 + 文件列表）            [构建: 需要 C1]

```text
Goal: 实现 KBDetailView 的主体部分——面包屑导航 + 文件夹/文件混合表格 + 上传 + 数据轮询。

Design decisions to preserve:
- 7 列 Grid: 32px 28px 1fr 70px 60px 80px 100px，不可改为 auto-fill 或 flex
- 文件夹和文件在同一表格混合显示，通过 className 区分样式
- 文件夹行颜色用 #3370ff（紫色），文件行正常颜色
- 5 秒轮询用 setInterval + fetchAll（Promise.all 并行 4 个 API）
- 上传按钮展开下拉菜单，位置基于 getBoundingClientRect 计算
- 搜索过滤是前端 toLowerCase + includes，不请求后端
- 文件大小 1024 进制格式化（B→KB→MB→GB）
- 状态：parse_status === "completed"|"classified" → 绿色"已完成"

Where the reference implementation is:
- frontend/src/views/KBDetail/KBDetailView.tsx
- frontend/src/views/KBDetail/KBDetailView.module.css
- backend/app/api/kb.py, documents.py, folders.py

Key logic:
- selectedFolder: null = 根目录，folder.id = 子目录
- filteredDocs = selectedFolder ? docs.filter(d => d.folder_id === selectedFolder) : docs
- 子文件夹通过 folders[].children 渲染
- 新建文件夹的 parent_id = selectedFolder（null = 根目录）

Acceptance:
- [ ] 面包屑支持点击"全部文件"回根目录
- [ ] 文件夹可点击进入，面包屑路径更新
- [ ] 7 列 CSS Grid 精确对齐
- [ ] 上传四入口下拉菜单
- [ ] 搜索框实时过滤文件名（前端）
- [ ] 数据每 5 秒自动刷新
```

---

## C3 — KB 详情 — 文件交互（悬停提示、右键菜单、多选批量）            [构建: 需要 C2]

```text
Goal: 实现文件行的 Tooltip、右键上下文菜单、多选系统、弹窗（重命名/标签/预览/批量移动）。

Design decisions to preserve:
- Tooltip 用 position:fixed，跟随 onMouseMove 实时更新位置
- 右键菜单用 onContextMenu + preventDefault 阻止浏览器默认
- 菜单内容根据 targetType 和 ids.length 动态变化
- 多选逻辑：右键的项已在 selectedIds 中 → 菜单上下文变批量模式
- 表头全选只看当前可见项（filteredDocs + visible folders）
- 批量 move/copy 逐项串行执行（for...of），非并行
- 所有弹窗复用 .overlay + .previewModal 样式

Where the reference implementation is:
- frontend/src/views/KBDetail/KBDetailView.tsx（约 300 行交互逻辑）
- frontend/src/views/KBDetail/KBDetailView.module.css

Key states:
- selectedIds: Set<string>
- contextMenu: { x, y, ids: string[], targetType, targetName } | null
- hoverInfo: { doc, x, y } | null
- renameModal / tagModal / batchMoveTarget: 各自独立 Modal 状态

Acceptance:
- [ ] 悬停弹出 Tooltip，跟随鼠标移动
- [ ] 右键/双击弹出上下文菜单
- [ ] 菜单内容随选中数量变化
- [ ] 表头复选框全选/取消
- [ ] 重命名/标签/预览弹窗功能正确
- [ ] 批量移动/复制文件夹选择器层级缩进
```

---

## C4 — KB 详情 — RAG 智能对话面板            [构建: 需要 C2]

```text
Goal: 实现 RAG 对话面板——会话管理、SSE 流式输出、范围限定、来源引用。

Design decisions to preserve:
- 对话状态集中在 Zustand chatStore（sessions / messages / isLoading / streamingContent）
- sendMessage 自动创建会话：title = question.slice(0, 30) + "..."
- SSE 解析用 ReadableStream + TextDecoder（不用 EventSource——需要 POST）
- 流结束后重新拉取消息同步 DB 中的 ID
- doc_id 和 folder_id 互斥：设置一个时清除另一个
- Markdown 渲染：react-markdown + remarkGfm
- 来源引用：<details> 折叠，150 字内容预览

Where the reference implementation is:
- frontend/src/stores/chatStore.ts（完整 sendMessage 流程）
- frontend/src/views/KBDetail/KBDetailView.tsx（聊天 UI）
- backend/app/api/rag.py（chat_stream 端点）
- backend/app/services/rag.py（retrieve + generate_stream）

Key backend pipeline:
- retrieve(): _multi_retrieve（向量+关键词+实体并行）→ expand（可选）→ merge → rerank（可选）
- source_weights = {vector:1.0, keyword:0.8, entity:0.9}
- _vector_search: pgvector <=> 操作符，支持 doc_id/folder_id 过滤
- generate_stream: RAG_SYSTEM_PROMPT "抓骨骼→立骨架→填血肉→点睛笔"
- SSE 首帧 {session_id, sources}，后续帧 {token}，末帧 [DONE]

Acceptance:
- [ ] 面板可展开/收起
- [ ] 会话新建/切换/删除
- [ ] 文档/文件夹范围标签 ✕ 清除
- [ ] Markdown 渲染正确
- [ ] SSE 流式逐字输出
- [ ] 来源引用折叠显示
- [ ] 复制/点赞/删除操作
- [ ] 对话持久化到数据库
```

---

## C5 — KB 详情 — FAQ 问答管理 & 推荐问题            [构建: 需要 C2]

```text
Goal: 文件列表下方添加 FAQ 管理区 + 推荐问题区。

Design decisions to preserve:
- FAQ 用 <details> 原生折叠，不用自定义组件
- FAQ 删除按钮需 e.preventDefault() 阻止折叠切换
- 推荐问题仅当 kb.recommended_questions?.length > 0 时渲染
- 推荐问题点击调用 sendMessage(q) 发送到对话面板

Where the reference implementation is:
- frontend/src/views/KBDetail/KBDetailView.tsx（FAQ + 推荐问题区域）
- backend/app/api/faq.py

Key API:
- GET /api/knowledge-bases/{id}/faq
- POST /api/knowledge-bases/{id}/faq { question, answer }
- DELETE /api/knowledge-bases/{id}/faq/{faq_id}

Acceptance:
- [ ] FAQ 标题 + 添加按钮
- [ ] <details> 折叠展示 FAQ
- [ ] 添加表单：问题 + 答案 + 保存/取消
- [ ] FAQ 可删除
- [ ] 推荐问题点击发送到对话面板
```

---

## C6 — 知识图谱可视化            [构建: 需要 C1]

```text
Goal: 实现 GraphView——KB 选择器、统计卡片、12 主题筛选、ECharts 力导向图、节点详情。

Design decisions to preserve:
- 12 个保险客服主题为前端硬编码常量 TOPICS
- 筛选管道：topic type 精确匹配 → searchQuery 模糊匹配 name/aliases/type
- 边过滤：只保留两端节点都在 visibleNodeIds 中的边
- 统计卡片数值来自 filteredData.nodes/edges.length
- node.symbolSize = 关联度（来自后端 alias 数量）

Where the reference implementation is:
- frontend/src/views/Graph/GraphView.tsx + GraphView.module.css
- frontend/src/components/Graph/GraphCanvas.tsx
- backend/app/api/graph_api.py + services/graph.py

Key logic:
- entityTypeMap = new Map(nodes.map(n => [n.id, n.type])) 用于边过滤
- 双过滤器：nodes filter → visibleNodeIds Set → edges filter
- KB 下拉菜单分组同 Operator 模式

Acceptance:
- [ ] KB 选择器分组，切换刷新图谱
- [ ] 4 个统计卡片
- [ ] 12 主题按钮点击筛选
- [ ] 搜索框模糊过滤
- [ ] ECharts 力导向图渲染
- [ ] 节点点击详情面板
```

---

## C7 — Agent Operator 全局智能导入面板            [构建: 需要 C1]

```text
Goal: 实现全站右侧 Agent Operator——对话式导入、function-calling 循环、面板拖拽。

Design decisions to preserve:
- 面板宽度 360px，拖拽调整 280-600px
- 折叠宽度 44px（只显示展开按钮）
- Agent 循环最多 3 轮
- 粘贴 URL 自动检测：/^https?:\/\/[^\s]+$/ 匹配，input 为空时触发
- 工具执行在 Operator 本地（后端 agent/chat 仅透明代理 LLM）
- upload_file 触发文件选择器后暂停循环
- 消息存储为本地 React state（不持久化）

Where the reference implementation is:
- frontend/src/components/Layout/Operator.tsx（~350 行）
- frontend/src/components/Layout/Operator.module.css
- frontend/src/skills/registry.ts + definitions/
- backend/app/api/rag.py（POST /{kb_id}/agent/chat）

Key details:
- AGENT_TOOLS: import_url（参数 url）+ upload_file（无参数）
- executeTool 根据 name switch 执行
- resize: mousedown → mousemove 更新 width → mouseup 恢复
- 欢迎界面在 messages.length === 0 时显示

Acceptance:
- [ ] 拖拽调整宽度（280-600px）
- [ ] KB 选择器分组
- [ ] thinking/tool/done/error 四种状态
- [ ] 粘贴 URL 自动导入
- [ ] 附件菜单两个选项
- [ ] 面板可折叠为 44px
```

---

## C8 — 系统设置页            [构建: 无依赖 · 可最先开发]

```text
Goal: 实现 SettingsView——后端配置展示、前端表单、模拟保存。

Design decisions to preserve:
- 配置从 GET /api/admin/config 加载，失败 fallback 到硬编码 DEFAULTS
- API Key 只读密码框（脱敏显示），提示修改 .env 后重启
- Embedding 模型只读（本地 sentence-transformers）
- 保存按钮前端模拟（setTimeout 500ms），不请求后端
- 保存后显示 "✓ 已保存"（绿色），2 秒恢复
- 底部状态条显示当前模型名

Where the reference implementation is:
- frontend/src/views/Settings/SettingsView.tsx + SettingsView.module.css
- backend/app/api/admin.py（GET /api/admin/config）
- backend/app/schemas/schemas.py（SystemConfig）

Key data:
- SystemConfig: llm_api_base, llm_model, embedding_model, chunk_size, chunk_overlap, rag_top_k, rag_similarity_threshold
- DEFAULTS: llm_api_base="https://api.openai.com/v1", llm_model="gpt-4o-mini", chunk_size=512, chunk_overlap=50, rag_top_k=5

Acceptance:
- [ ] 四组表单（LLM/Embedding/分块/RAG）
- [ ] API Key 只读脱敏
- [ ] 数字输入 min/max/step
- [ ] 保存按钮状态切换
- [ ] 底部状态条
```
