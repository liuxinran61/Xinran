// ===== Toast Store — 全局通知提示（Zustand）===============================
//
// 三种类型：success（3s）/ error（4s）/ info（3s）
// 自动消失，手动可 dismiss
import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000);
  },
  success: (msg) => { const id = crypto.randomUUID(); set((s) => ({ toasts: [...s.toasts, { id, message: msg, type: "success" }] })); setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000); },
  error: (msg) => { const id = crypto.randomUUID(); set((s) => ({ toasts: [...s.toasts, { id, message: msg, type: "error" }] })); setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000); },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
