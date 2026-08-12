// ===== UI Store — 全局 UI 状态（Zustand）==================================
//
// 管理：
//   - sidebarCollapsed — 侧边栏折叠状态
//   - operatorCollapsed — 操作台面板折叠状态
//   - breakpoint — 响应式断点（desktop/tablet/mobile/phone）
//   - activeView — 当前活跃视图名称
import { create } from "zustand";

export type Breakpoint = "desktop" | "tablet" | "mobile" | "phone";

interface UIState {
  sidebarCollapsed: boolean;
  operatorCollapsed: boolean;
  activeView: string;
  breakpoint: Breakpoint;
  toggleSidebar: () => void;
  toggleOperator: () => void;
  setBreakpoint: (bp: Breakpoint) => void;
  setActiveView: (view: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  operatorCollapsed: false,
  activeView: "dashboard",
  breakpoint: "desktop",

  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  toggleOperator: () =>
    set((s) => ({ operatorCollapsed: !s.operatorCollapsed })),

  setBreakpoint: (bp) => set({ breakpoint: bp }),

  setActiveView: (view) => set({ activeView: view }),
}));
