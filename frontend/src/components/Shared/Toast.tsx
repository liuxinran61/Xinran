// ===== Toast Notifications =====
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore } from "../../stores/toastStore";
import styles from "./Toast.module.css";

const icons = { success: CheckCircle2, error: XCircle, info: Info };

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
            <Icon size={16} />
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
