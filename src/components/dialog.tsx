"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./ui";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        "m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)]",
        width,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div>
              <h2 className="font-serif text-[21px] leading-tight font-[450]">{title}</h2>
              {description && <p className="mt-1 text-[13.5px] text-muted">{description}</p>}
            </div>
            <button onClick={onClose} className="-mr-2 rounded-md p-1.5 text-muted hover:bg-paper-deep hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line bg-paper/50 px-6 py-3.5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
