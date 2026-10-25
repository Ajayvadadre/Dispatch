"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the server-rendered page on an interval while something is in flight. */
export function AutoRefresh({ active = true, every = 2500 }: { active?: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [active, every, router]);
  return null;
}
