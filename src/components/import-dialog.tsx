"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import type { ImportPreview } from "@/lib/doctors";
import { api, errorMessage } from "./client";
import { Dialog } from "./dialog";
import { toast } from "./toast";
import { Button, cx } from "./ui";

export function ImportButton({ hasDoctors }: { hasDoctors: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [removeMissing, setRemoveMissing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const choose = async (f: File | undefined | null) => {
    if (!f) return;
    setFile(f);
    setBusy(true);
    const form = new FormData();
    form.set("file", f);
    form.set("mode", "preview");
    try {
      const { preview } = await api<{ preview: ImportPreview }>("/api/doctors/import", { form });
      setPreview(preview);
    } catch (err) {
      toast(errorMessage(err), "error");
      reset();
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("mode", "apply");
    form.set("removeMissing", String(removeMissing));
    try {
      const { result } = await api<{ result: { added: number; updated: number; removed: number } }>("/api/doctors/import", { form });
      const parts = [result.added && `${result.added} added`, result.updated && `${result.updated} updated`, result.removed && `${result.removed} removed`].filter(Boolean);
      toast(parts.length ? `Doctors list updated: ${parts.join(", ")}.` : "Doctors list is already up to date.");
      close();
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="primary" icon={<Upload className="size-4" />} onClick={() => setOpen(true)}>
        {hasDoctors ? "Upload updated sheet" : "Upload Excel"}
      </Button>
      <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />

      <Dialog
        open={open}
        onClose={close}
        title={preview ? "Review changes" : "Upload doctors sheet"}
        description={preview ? file?.name : "An .xlsx or .csv file with an Email column. Name, Specialty, City and Hospital are optional."}
        width="max-w-xl"
        footer={
          preview && (
            <>
              <Button variant="ghost" onClick={reset}>
                Choose another file
              </Button>
              <Button variant="primary" loading={busy} disabled={!preview.valid} onClick={apply}>
                Update doctors list
              </Button>
            </>
          )
        }
      >
        {!preview ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files?.[0]);
            }}
            className={cx(
              "flex w-full flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-pine bg-pine-soft/50" : "border-line-strong bg-paper/40 hover:border-faint hover:bg-paper/70",
            )}
          >
            <FileSpreadsheet className="mb-2.5 size-6 text-pine" strokeWidth={1.5} />
            <span className="text-[14px] font-medium">{busy ? "Reading the file…" : "Drop the Excel file here, or click to browse"}</span>
            <span className="mt-1 text-[12.5px] text-muted">Nothing changes until you confirm on the next step.</span>
          </button>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-line">
              <Num label="New" value={preview.added} tone="text-pine" />
              <Num label="Updated" value={preview.updated} />
              <Num label="Unchanged" value={preview.unchanged} />
              <Num label="Not in file" value={preview.removed} tone={preview.removed ? "text-brick" : undefined} />
            </div>

            <p className="text-[13px] text-muted">
              Read {preview.totalRows} rows: <span className="text-ink">{preview.valid} valid emails</span>
              {preview.duplicates > 0 && `, ${preview.duplicates} duplicates skipped`}
              {preview.invalid.length > 0 && `, ${preview.invalid.length} rows with problems`}.
            </p>

            {preview.removed > 0 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-paper/50 px-4 py-3">
                <input type="checkbox" checked={removeMissing} onChange={(e) => setRemoveMissing(e.target.checked)} className="mt-0.5 size-4 accent-pine" />
                <span className="text-[13.5px]">
                  <span className="font-medium">Remove {preview.removed} {preview.removed === 1 ? "doctor who isn't" : "doctors who aren't"} in this file</span>
                  <span className="block text-[12.5px] text-muted">
                    The sheet becomes the full list. e.g. {preview.sampleRemoved.map((d) => d.name || d.email).join(", ")}
                    {preview.removed > preview.sampleRemoved.length ? "…" : ""}
                  </span>
                </span>
              </label>
            )}

            {preview.invalid.length > 0 && (
              <div>
                <div className="mb-2 text-[12px] font-medium tracking-[0.1em] text-muted uppercase">Skipped rows</div>
                <div className="scroll-quiet max-h-40 overflow-y-auto rounded-lg border border-line">
                  {preview.invalid.map((r) => (
                    <div key={r.row} className="flex gap-4 border-b border-line px-3.5 py-2 text-[13px] last:border-0">
                      <span className="w-14 shrink-0 font-mono text-[12px] text-muted">Row {r.row}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{r.value || "—"}</span>
                      <span className="text-brick">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

function Num({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border-r border-line px-4 py-3 last:border-0">
      <div className={cx("font-serif text-[26px] leading-none font-[420] tabular-nums", tone)}>{value}</div>
      <div className="mt-1.5 text-[12px] text-muted">{label}</div>
    </div>
  );
}
