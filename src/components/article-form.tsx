"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload, X } from "lucide-react";
import { DEFAULT_MESSAGE } from "@/lib/email/defaults";
import type { Recurrence } from "@/lib/db/schema";
import { api, errorMessage } from "./client";
import { toast } from "./toast";
import { Button, Card, cx, Field, inputClass, LinkButton, PdfGlyph } from "./ui";

export interface ArticleFormValues {
  id?: number;
  title: string;
  subject: string;
  message: string;
  recurrence: Recurrence;
  startAt: string; // datetime-local in app timezone
  endDate: string;
  pdfName?: string;
  pdfSize?: number;
}

const RECURRENCE_OPTIONS: { value: Recurrence; label: string; hint: string }[] = [
  { value: "once", label: "One time", hint: "Send once" },
  { value: "daily", label: "Daily", hint: "Every day" },
  { value: "weekly", label: "Weekly", hint: "Same weekday" },
];

/** Wall-clock parts of `date` in the app timezone. */
function localParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, weekday: get("weekday") };
}

const toInput = (date: Date, tz: string) => {
  const p = localParts(date, tz);
  return `${p.date}T${p.time}`;
};

function addDays(input: string, days: number) {
  const [d, t] = input.split("T");
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.toISOString().slice(0, 10)}T${t}`;
}

function describe(input: string, recurrence: Recurrence, endDate: string) {
  if (!input) return "Pick when the first email should go out.";
  const [d, t] = input.split("T");
  const date = new Date(`${d}T${t}:00Z`);
  const opts = { timeZone: "UTC" } as const;
  const day = date.toLocaleDateString("en-IN", { ...opts, weekday: "long" });
  const pretty = date.toLocaleDateString("en-IN", { ...opts, day: "numeric", month: "long" });
  const time = date.toLocaleTimeString("en-IN", { ...opts, hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  const until = endDate
    ? `, until ${new Date(`${endDate}T00:00:00Z`).toLocaleDateString("en-IN", { ...opts, day: "numeric", month: "long" })}`
    : ", until you pause it";
  if (recurrence === "once") return `Sends once on ${day}, ${pretty} at ${time}.`;
  if (recurrence === "daily") return `Sends every day at ${time}, starting ${pretty}${until}.`;
  return `Sends every ${day} at ${time}, starting ${pretty}${until}.`;
}

export function ArticleForm({
  initial,
  timezone,
  doctorCount,
  senderName,
}: {
  initial?: ArticleFormValues;
  timezone: string;
  doctorCount: number;
  senderName: string;
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [message, setMessage] = useState(initial?.message ?? DEFAULT_MESSAGE);
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? "weekly");
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [saving, setSaving] = useState(false);

  // Computed on click so "in 2 minutes" is relative to when it's pressed.
  const quickPicks = useMemo(() => {
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return [
      { label: "In 2 minutes", get: () => toInput(new Date(Date.now() + 2 * 60_000), timezone) },
      { label: "Tomorrow, 10 AM", get: () => `${addDays(toInput(new Date(), timezone), 1).slice(0, 10)}T10:00` },
      {
        label: "Next Monday, 10 AM",
        get: () => {
          const today = localParts(new Date(), timezone);
          return addDays(`${today.date}T10:00`, 7 - order.indexOf(today.weekday) || 7);
        },
      },
    ];
  }, [timezone]);
  const [picked, setPicked] = useState<string | null>(null);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast("Please choose a PDF file.", "error");
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(
        f.name
          .replace(/\.pdf$/i, "")
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/^./, (c) => c.toUpperCase()),
      );
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    form.set("title", title);
    form.set("subject", subject);
    form.set("message", message);
    form.set("recurrence", recurrence);
    form.set("startAt", startAt);
    form.set("endDate", recurrence === "once" ? "" : endDate);
    if (file) form.set("pdf", file);
    setSaving(true);
    try {
      const { article } = await api<{ article: { id: number } }>(editing ? `/api/articles/${initial!.id}` : "/api/articles", {
        method: editing ? "PATCH" : "POST",
        form,
      });
      toast(editing ? "Changes saved." : "Article scheduled.");
      router.push(`/articles/${article.id}`);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
      setSaving(false);
    }
  };

  const shownName = file?.name ?? initial?.pdfName;
  const shownSize = file?.size ?? initial?.pdfSize;
  const vars = { name: "Dr. Ananya Rao", title: title || "Article title" };
  const fill = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k.toLowerCase() as keyof typeof vars] ?? m);

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <Card className="p-5">
          <SectionTitle n={1} title="Article PDF" />
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          {shownName ? (
            <div className="flex items-center gap-3.5 rounded-lg border border-line bg-paper/50 px-4 py-3">
              <PdfGlyph />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{shownName}</div>
                <div className="text-[12.5px] text-muted">
                  {shownSize ? (shownSize < 1024 * 1024 ? `${Math.max(1, Math.round(shownSize / 1024))} KB` : `${(shownSize / 1024 / 1024).toFixed(1)} MB`) : ""}
                  {file && editing ? " · will replace the current PDF" : ""}
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
                Replace
              </Button>
              {file && (
                <button type="button" onClick={() => setFile(null)} className="rounded-md p-1 text-muted hover:bg-paper-deep hover:text-ink" aria-label="Remove file">
                  <X className="size-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cx(
                "flex w-full flex-col items-center rounded-lg border border-dashed px-6 py-9 text-center transition-colors",
                dragging ? "border-pine bg-pine-soft/50" : "border-line-strong bg-paper/40 hover:border-faint hover:bg-paper/70",
              )}
            >
              <Upload className="mb-2.5 size-5 text-muted" strokeWidth={1.75} />
              <span className="text-[14px] font-medium text-ink">Drop the article PDF here, or click to browse</span>
              <span className="mt-1 text-[12.5px] text-muted">Up to 25 MB. It will be attached to every email.</span>
            </button>
          )}
          <div className="mt-5">
            <Field label="Title" htmlFor="title" hint="Shown in the app and available in the email as {{title}}.">
              <input id="title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advances in endometrial receptivity testing" required />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle n={2} title="Schedule" />
          <div className="mb-5 grid grid-cols-3 gap-2" role="radiogroup">
            {RECURRENCE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={recurrence === o.value}
                onClick={() => setRecurrence(o.value)}
                className={cx(
                  "rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                  recurrence === o.value ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface hover:border-faint",
                )}
              >
                <div className="text-[13.5px] font-medium">{o.label}</div>
                <div className={cx("text-[12px]", recurrence === o.value ? "text-paper/65" : "text-muted")}>{o.hint}</div>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={recurrence === "once" ? "Send on" : "First send"} htmlFor="startAt">
              <input id="startAt" type="datetime-local" className={cx(inputClass, "font-mono text-[13px]")} value={startAt} onChange={(e) => {
                  setStartAt(e.target.value);
                  setPicked(null);
                }} required />
            </Field>
            {recurrence !== "once" && (
              <Field label="Stop after" htmlFor="endDate" optional>
                <input id="endDate" type="date" className={cx(inputClass, "font-mono text-[13px]")} value={endDate} min={startAt.slice(0, 10)} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickPicks.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => {
                  setStartAt(q.get());
                  setPicked(q.label);
                }}
                className={cx(
                  "rounded-full border px-2.5 py-1 text-[12.5px] transition-colors",
                  picked === q.label ? "border-pine bg-pine-soft text-pine-ink" : "border-line text-ink-2 hover:border-line-strong hover:bg-paper",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-paper px-3.5 py-2.5 text-[13px] text-ink-2">
            {describe(startAt, recurrence, endDate)}{" "}
            {recurrence !== "once" && startAt && "It pauses automatically once that email has gone out. "}
            <span className="text-muted">Times are in {timezone}.</span>
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle n={3} title="Email" />
          <div className="space-y-4">
            <Field label="Subject" htmlFor="subject" hint="Leave blank to use the article title.">
              <input id="subject" className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={title || "Subject line"} />
            </Field>
            <Field
              label="Message"
              htmlFor="message"
              hint={
                <>
                  This is the whole email body; the PDF is attached. Optional: <code className="font-mono text-[12px]">{"{{name}}"}</code> and{" "}
                  <code className="font-mono text-[12px]">{"{{title}}"}</code> are filled in for each doctor.
                </>
              }
            >
              <textarea id="message" rows={5} className={cx(inputClass, "resize-y leading-relaxed")} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <LinkButton href={editing ? `/articles/${initial!.id}` : "/articles"} variant="ghost">
            Cancel
          </LinkButton>
          <Button type="submit" variant="primary" loading={saving}>
            {editing ? "Save changes" : "Schedule article"}
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-8 lg:col-span-5">
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <span className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Preview</span>
          <span className="text-[12px] text-muted">Goes to {doctorCount.toLocaleString("en-IN")} doctors, one email each</span>
        </div>
        <Card className="overflow-hidden">
          <div className="space-y-1 border-b border-line bg-paper/50 px-5 py-3.5 text-[12.5px]">
            <Row k="From" v={senderName} />
            <Row k="To" v="Dr. Ananya Rao" />
            <Row k="Subject" v={<span className="font-medium text-ink">{fill(subject || title) || "—"}</span>} />
          </div>
          <div className="px-5 py-5 text-[13.5px] leading-relaxed text-ink">
            {fill(message)
              .split(/\n{2,}/)
              .map((p, i) => (
                <p key={i} className="mb-3 whitespace-pre-line last:mb-0">
                  {p}
                </p>
              ))}
          </div>
          <div className="flex items-center gap-2.5 border-t border-line bg-paper/50 px-5 py-3">
            <Paperclip className="size-3.5 text-muted" />
            <span className="truncate text-[12.5px] font-medium">{shownName ?? "article.pdf"}</span>
          </div>
        </Card>
      </div>
    </form>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="grid size-5 place-items-center rounded-full bg-paper-deep font-mono text-[11px] text-ink-2">{n}</span>
      <h2 className="text-[14px] font-semibold">{title}</h2>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-14 shrink-0 text-muted">{k}</span>
      <span className="min-w-0 truncate text-ink-2">{v}</span>
    </div>
  );
}
