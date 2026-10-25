"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Paperclip, RotateCcw, Search, Square } from "lucide-react";
import type { DeliveryStatus, RunStatus } from "@/lib/db/schema";
import { api, errorMessage } from "./client";
import { Dialog } from "./dialog";
import { DeliveryStatusPill } from "./status";
import { toast } from "./toast";
import { Button, Card, cx, inputClass } from "./ui";

export interface DeliveryRow {
  id: number;
  name: string;
  email: string;
  status: DeliveryStatus;
  error: string | null;
  sentAt: string | null;
}

type Filter = "all" | "sent" | "failed" | "waiting";

export function RunActions({ runId, status, failed }: { runId: number; status: RunStatus; failed: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const live = status === "queued" || status === "sending";

  const act = async (action: "retry" | "cancel") => {
    setBusy(action);
    try {
      const res = await api<{ retried?: number }>(`/api/runs/${runId}`, { json: { action } });
      toast(action === "retry" ? `Retrying ${res.retried} failed email${res.retried === 1 ? "" : "s"}.` : "Send stopped. Nothing more will go out.");
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {failed > 0 && !live && (
        <Button icon={<RotateCcw className="size-4" />} loading={busy === "retry"} onClick={() => act("retry")}>
          Retry {failed} failed
        </Button>
      )}
      {live && (
        <Button variant="danger" icon={<Square className="size-3.5" />} loading={busy === "cancel"} onClick={() => act("cancel")}>
          Stop sending
        </Button>
      )}
    </>
  );
}

export function DeliveriesTable({ rows, timezone, pdfName }: { rows: DeliveryRow[]; timezone: string; pdfName: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<DeliveryRow | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      sent: rows.filter((r) => r.status === "sent").length,
      failed: rows.filter((r) => r.status === "failed").length,
      waiting: rows.filter((r) => r.status === "pending" || r.status === "sending").length,
    }),
    [rows],
  );

  const shown = rows.filter((r) => {
    if (filter === "sent" && r.status !== "sent") return false;
    if (filter === "failed" && r.status !== "failed") return false;
    if (filter === "waiting" && r.status !== "pending" && r.status !== "sending") return false;
    const q = query.trim().toLowerCase();
    return !q || r.email.includes(q) || r.name.toLowerCase().includes(q);
  });

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", { timeZone: timezone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase();

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input className={cx(inputClass, "border-transparent bg-paper pl-9 hover:border-line focus:bg-surface")} placeholder="Find a doctor…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex rounded-lg bg-paper p-0.5">
          {(["all", "sent", "failed", "waiting"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cx(
                "rounded-md px-3 py-1.5 text-[12.5px] capitalize transition-colors",
                filter === f ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink",
              )}
            >
              {f} <span className="ml-0.5 font-mono text-[11.5px] text-faint">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-quiet max-h-[560px] overflow-auto">
        <table className="w-full text-left text-[13.5px]">
          <thead className="sticky top-0 z-10 bg-surface text-[12px] text-muted">
            <tr className="shadow-[inset_0_-1px_0_var(--color-line)]">
              <th className="px-5 py-2.5 font-normal">Recipient</th>
              <th className="px-3 py-2.5 font-normal">Status</th>
              <th className="px-3 py-2.5 font-normal">Time</th>
              <th className="px-3 py-2.5 font-normal">Details</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.id} className="group hover:bg-paper/50">
                <td className="px-5 py-2.5">
                  <div className="font-medium">{r.name || <span className="font-normal text-faint">No name</span>}</div>
                  <div className="font-mono text-[12px] text-muted">{r.email}</div>
                </td>
                <td className="px-3 py-2.5">
                  <DeliveryStatusPill status={r.status} />
                </td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink-2">{r.sentAt ? time(r.sentAt) : <span className="text-faint">—</span>}</td>
                <td className="max-w-80 px-3 py-2.5 text-[12.5px] text-brick">{r.error}</td>
                <td className="pr-4 text-right">
                  <button onClick={() => setPreview(r)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-muted opacity-0 transition group-hover:opacity-100 hover:bg-paper-deep hover:text-ink focus:opacity-100">
                    <Eye className="size-3.5" /> Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-5 py-10 text-center text-[13.5px] text-muted">Nothing here.</p>}
      </div>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} title="Email preview" description={preview ? `As received by ${preview.email}` : undefined} width="max-w-2xl">
        {preview && (
          <div className="overflow-hidden rounded-lg border border-line">
            <iframe src={`/api/deliveries/${preview.id}/preview`} title="Email preview" className="block h-[240px] w-full bg-white" />
            <div className="flex items-center gap-2.5 border-t border-line bg-paper/50 px-4 py-2.5">
              <Paperclip className="size-3.5 text-muted" />
              <span className="truncate text-[12.5px] font-medium">{pdfName}</span>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}
