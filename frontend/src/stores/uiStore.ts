// ===== AI Knowledge OS Web — UI Store =====
import { create } from "zustand";

export type Breakpoint = "desktop" | "tablet" | "mobile" | "phone";

interface UIState {
  sidebarCollapsed: boolean;
  copilotCollapsed: boolean;
  activeView: string;
  breakpoint: Breakpoint;
  toggleSidebar: () => void;
  toggleCopilot: () => void;
  setBreakpoint: (bp: Breakpoint) => void;
  setActiveView: (view: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  copilotCollapsed: false,
  activeView: "dashboard",
  breakpoint: "desktop",

  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  toggleCopilot: () =>
    set((s) => ({ copilotCollapsed: !s.copilotCollapsed })),

  setBreakpoint: (bp) => set({ breakpoint: bp }),

  setActiveView: (view) => set({ activeView: view }),
}));
