// ===== Knowledge OS — 应用入口 & 路由配置 =================================
//
// 路由表（全部在 AppLayout 三列壳层内渲染）：
//   /           → HomeView（空状态提示）
//   /kb/:id     → KBDetailView（知识库详情 — 文件浏览 + RAG 对话）
//   /graph      → GraphView（知识图谱可视化）
//   /settings   → SettingsView（系统配置）
//
// AppLayout = Sidebar(220px) | <Outlet> | Operator(360px)
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/Layout/AppLayout";
import { KBDetailView } from "./views/KBDetail/KBDetailView";
import { GraphView } from "./views/Graph/GraphView";
import { SettingsView } from "./views/Settings/SettingsView";
import { ToastContainer } from "./components/Shared/Toast";
import "./styles/global.css";

function HomeView() {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", background:"var(--kos-bg)", color:"var(--kos-text-muted)", flexDirection:"column", gap:12 }}>
    <h2 style={{color:"var(--kos-text)",fontSize:18}}>Knowledge OS</h2>
    <p>从左侧选择或创建一个知识库开始</p>
  </div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomeView />} />
          <Route path="kb/:id" element={<KBDetailView />} />
          <Route path="graph" element={<GraphView />} />
          <Route path="settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
