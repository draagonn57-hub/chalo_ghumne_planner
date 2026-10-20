import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

/**
 * ConfirmModal — accessible confirmation dialog.
 *
 * Props:
 *   open         boolean
 *   title        string
 *   message      string
 *   confirmLabel string  (default "Confirm")
 *   cancelLabel  string  (default "Cancel")
 *   onConfirm    () => void
 *   onCancel     () => void
 *   danger       boolean — style confirm button as destructive (red)
 */
export default function ConfirmModal({
  open,
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
}) {
  const cancelRef = useRef(null);
  const titleId = "confirm-modal-title";
  const prevFocusRef = useRef(null);

  // Save trigger element + initial focus on Cancel
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement;
      // Defer so the dialog is in the DOM
      requestAnimationFrame(() => cancelRef.current?.focus());
    } else if (prevFocusRef.current) {
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    }
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel?.();
      // Focus trap
      if (e.key === "Tab") {
        const dialog = cancelRef.current?.closest('[role="dialog"]');
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#233140] shadow-2xl p-6"
          >
            {/* Icon + Title */}
            <div className="flex items-start gap-3 mb-3">
              {danger && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                </div>
              )}
              <div>
                <h2
                  id={titleId}
                  className="text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  {title}
                </h2>
                {message && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-5">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className="btn-secondary text-sm px-4 py-2"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`text-sm px-4 py-2 rounded-full font-semibold text-white transition-colors ${
                  danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#0D5C75] hover:bg-[#0A485C]"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
