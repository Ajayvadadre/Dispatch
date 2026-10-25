"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cx } from "./ui";

interface ToastItem {
  id: number;
  message: string;
  kind: "success" | "error";
}

const EVENT = "dispatch:toast";

export function toast(message: string, kind: ToastItem["kind"] = "success") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let id = 0;
    const onToast = (e: Event) => {
      const item = { id: ++id, ...(e as CustomEvent).detail } as ToastItem;
      setItems((list) => [...list.slice(-2), item]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== item.id)), item.kind === "error" ? 6000 : 3500);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col items-end gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            "pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg border bg-surface px-3.5 py-2.5 text-[13.5px] shadow-[var(--shadow-pop)]",
            t.kind === "error" ? "border-brick/30" : "border-line",
          )}
          style={{ animation: "rise 160ms ease-out" }}
        >
          {t.kind === "error" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-brick" />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-pine" />
          )}
          <span className="text-ink">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
