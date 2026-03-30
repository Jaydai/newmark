"use client";

import { useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react";

export interface ExportToastRef {
  show: (msg: string) => void;
  showUndo: (msg: string, onUndo: () => void) => void;
}

export const ExportToast = forwardRef<ExportToastRef>(function ExportToast(_, ref) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [undoFn, setUndoFn] = useState<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((msg: string) => {
    clearTimeout(timerRef.current);
    setMessage(msg);
    setUndoFn(null);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 2200);
  }, []);

  const showUndo = useCallback((msg: string, onUndo: () => void) => {
    clearTimeout(timerRef.current);
    setMessage(msg);
    setUndoFn(() => onUndo);
    setVisible(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setUndoFn(null);
    }, 4000);
  }, []);

  useImperativeHandle(ref, () => ({ show, showUndo }), [show, showUndo]);

  return (
    <div
      id="exportToast"
      className={`fixed bottom-7 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-3 rounded-[10px] text-xs font-semibold shadow-[0_8px_32px_rgba(0,0,0,.2)] z-[9999] transition-all duration-300 pointer-events-none ${
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-5"
      }`}
      role="status"
      aria-live="polite"
    >
      {message}
      {undoFn && (
        <button
          onClick={() => {
            undoFn();
            clearTimeout(timerRef.current);
            setVisible(false);
            setUndoFn(null);
          }}
          className="ml-3 bg-white text-foreground border-none rounded-md px-3 py-1 text-[11px] font-bold cursor-pointer"
        >
          Annuler
        </button>
      )}
    </div>
  );
});
