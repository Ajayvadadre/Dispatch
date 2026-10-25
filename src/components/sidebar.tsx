"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, FileText, LayoutGrid, LogOut, Settings2, Users } from "lucide-react";
import { cx } from "./ui";

const nav = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/articles", label: "Articles", icon: FileText },
  { href: "/doctors", label: "Doctors", icon: Users },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar({
  provider,
  providerReady,
  authEnabled,
}: {
  provider: string;
  providerReady: boolean;
  authEnabled: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-paper-deep/60 px-3.5 py-5">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <Mark />
        <span className="font-serif text-[21px] leading-none font-[480] tracking-[-0.01em]">Dispatch</span>
      </Link>

      <nav className="space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cx(
                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors",
                active ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-paper-deep hover:text-ink",
              )}
            >
              <Icon className={cx("size-[15px]", active ? "text-pine" : "text-muted")} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1">
        <Link
          href="/settings"
          className="block rounded-lg border border-line bg-surface/70 px-3 py-2.5 transition-colors hover:border-line-strong"
        >
          <div className="text-[11px] font-medium tracking-[0.1em] text-muted uppercase">Sending via</div>
          <div className="mt-1 flex items-center gap-2 text-[13px] font-medium text-ink">
            <span className={cx("size-1.5 rounded-full", providerReady ? "bg-pine" : "bg-amber")} />
            {provider}
          </div>
        </Link>
        {authEnabled && (
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] text-muted transition-colors hover:bg-paper-deep hover:text-ink"
          >
            <LogOut className="size-[15px]" strokeWidth={1.75} />
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

/** Folded-letter mark. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cx("size-7", className)} aria-hidden>
      <rect x="1" y="1" width="26" height="26" rx="7" className="fill-pine" />
      <path d="M7.5 10.5h13v8.25a1.25 1.25 0 0 1-1.25 1.25H8.75A1.25 1.25 0 0 1 7.5 18.75z" fill="#fff" opacity=".96" />
      <path d="m7.5 10.75 6.5 4.75 6.5-4.75" fill="none" stroke="#1e5b4b" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
