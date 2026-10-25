import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ─── Buttons ────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "destructive" | "accent";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 select-none";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-black",
  accent: "bg-pine text-white hover:bg-pine-ink",
  secondary: "bg-surface text-ink border border-line-strong hover:border-faint hover:bg-paper/60",
  ghost: "text-ink-2 hover:bg-paper-deep hover:text-ink",
  danger: "text-brick hover:bg-brick-soft",
  destructive: "bg-brick text-white hover:bg-brick/90",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-[13.5px]",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cx(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant, size, loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function LinkButton({ variant, size, icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {back && <div className="mb-5">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow && <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>}
          <h1 className="font-serif text-[34px] leading-[1.1] font-[420] tracking-[-0.015em] text-ink">{title}</h1>
          {description && <p className="mt-2.5 max-w-2xl text-[14.5px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("text-[11px] font-medium tracking-[0.12em] text-muted uppercase", className)}>{children}</div>
  );
}

export function Card({ children, className, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-card border border-line bg-surface", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, meta, action }: { title: ReactNode; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-[13.5px] font-semibold text-ink">{title}</h2>
        {meta && <span className="text-[12.5px] text-muted">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-full bg-paper-deep text-muted">{icon}</div>}
      <p className="font-serif text-[19px] font-[450] text-ink">{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-[13.5px] text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Status ─────────────────────────────────────────────────────────────────

export type Tone = "pine" | "amber" | "sky" | "brick" | "stone";

const tones: Record<Tone, string> = {
  pine: "bg-pine-soft text-pine-ink",
  amber: "bg-amber-soft text-amber",
  sky: "bg-sky-soft text-sky",
  brick: "bg-brick-soft text-brick",
  stone: "bg-stone-soft text-ink-2",
};
const dots: Record<Tone, string> = {
  pine: "bg-pine",
  amber: "bg-amber",
  sky: "bg-sky",
  brick: "bg-brick",
  stone: "bg-faint",
};

export function Pill({ tone, children, live }: { tone: Tone; children: ReactNode; live?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[12px] leading-none font-medium", tones[tone])}>
      <span className={cx("size-1.5 rounded-full", dots[tone], live && "animate-pulse-dot")} />
      {children}
    </span>
  );
}

export function Progress({ value, total, failed = 0, className }: { value: number; total: number; failed?: number; className?: string }) {
  const pct = total ? (value / total) * 100 : 0;
  const failPct = total ? (failed / total) * 100 : 0;
  return (
    <div className={cx("flex h-1.5 overflow-hidden rounded-full bg-paper-deep", className)}>
      <div className="h-full bg-pine transition-[width] duration-500" style={{ width: `${pct}%` }} />
      <div className="h-full bg-brick/80 transition-[width] duration-500" style={{ width: `${failPct}%` }} />
    </div>
  );
}

// ─── Forms ──────────────────────────────────────────────────────────────────

export const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-faint transition-colors hover:border-faint focus:border-ink focus:outline-none focus-visible:outline-none";

export function Field({ label, hint, htmlFor, children, optional }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[13px] font-medium text-ink">
        {label}
        {optional && <span className="text-[12px] font-normal text-faint">Optional</span>}
      </label>
      {children}
      {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}

// ─── Misc ───────────────────────────────────────────────────────────────────

/** A small "sheet of paper" glyph used for article PDFs. */
export function PdfGlyph({ className }: { className?: string }) {
  return (
    <div className={cx("relative h-11 w-9 shrink-0 rounded-[3px] border border-line-strong bg-surface", className)}>
      <div className="absolute top-0 right-0 size-2.5 rounded-bl-[3px] border-b border-l border-line-strong bg-paper-deep" />
      <div className="absolute inset-x-1.5 top-3.5 space-y-[3px]">
        <div className="h-[2px] rounded bg-line-strong" />
        <div className="h-[2px] w-4/5 rounded bg-line" />
        <div className="h-[2px] rounded bg-line" />
      </div>
      <div className="absolute bottom-1 left-1 rounded-[2px] bg-brick px-[3px] py-px font-mono text-[7px] leading-none font-medium tracking-wide text-white">
        PDF
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <code className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[12px] text-ink-2">{children}</code>;
}
