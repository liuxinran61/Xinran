// ===== AI Knowledge OS Web — AppLayout =====
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import clsx from "clsx";
import { Sidebar } from "./Sidebar";
import { Copilot } from "./Copilot";
import { useUIStore } from "../../stores/uiStore";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const copilotCollapsed = useUIStore((s) => s.copilotCollapsed);
  const setBreakpoint = useUIStore((s) => s.setBreakpoint);

  useEffect(() => {
    const handle = () => {
      const w = window.innerWidth;
      if (w > 1180) setBreakpoint("desktop");
      else if (w > 930) setBreakpoint("tablet");
      else if (w > 760) setBreakpoint("mobile");
      else setBreakpoint("phone");
    };
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [setBreakpoint]);

  return (
    <div
      className={clsx(
        styles.app,
        sidebarCollapsed && styles.sidebarCollapsed,
        copilotCollapsed && styles.copilotCollapsed
      )}
    >
      <Sidebar />
      <Outlet />
      <Copilot />
    </div>
  );
}
