"use client";

import { ReactNode, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

interface SidePanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export default function SidePanel({
  open,
  title,
  onClose,
  busy,
  children,
  footer,
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          "input,textarea,button,select,[tabindex]:not([tabindex='-1'])"
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [open, busy, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [handleKeydown]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-[4px] z-[2000] transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => !busy && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed top-0 w-[460px] max-w-[94vw] h-screen bg-surface-card z-[2001] flex flex-col transition-[right] duration-350 ease-[cubic-bezier(.4,0,.2,1)] shadow-[-12px_0_60px_rgba(0,0,0,.25)] ${
          open ? "right-0" : "-right-[500px]"
        }`}
      >
        <div className="bg-primary text-white px-6 py-5 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold tracking-wide">{title}</h2>
          <button
            onClick={() => !busy && onClose()}
            className="bg-transparent border-none text-white/60 text-[22px] cursor-pointer p-1 px-2.5 rounded-md hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-border flex gap-2.5 shrink-0 bg-surface">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
