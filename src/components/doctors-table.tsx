"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search } from "lucide-react";
import type { Doctor } from "@/lib/db/schema";
import { api, errorMessage } from "./client";
import { Dialog } from "./dialog";
import { toast } from "./toast";
import { Button, Card, cx, Field, inputClass } from "./ui";

type Row = Pick<Doctor, "id" | "name" | "email" | "specialty" | "city" | "hospital" | "active">;
type Filter = "all" | "active" | "paused";

const empty = { name: "", email: "", specialty: "", city: "", hospital: "" };

export function DoctorsTable({ doctors }: { doctors: Row[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors.filter((d) => {
      if (filter === "active" && !d.active) return false;
      if (filter === "paused" && d.active) return false;
      if (!q) return true;
      return [d.name, d.email, d.specialty, d.city, d.hospital].some((v) => v?.toLowerCase().includes(q));
    });
  }, [doctors, query, filter]);

  const counts = { all: doctors.length, active: doctors.filter((d) => d.active).length, paused: doctors.filter((d) => !d.active).length };

  const openEditor = (row: Row | "new") => {
    setEditing(row);
    setDraft(row === "new" ? empty : { name: row.name, email: row.email, specialty: row.specialty ?? "", city: row.city ?? "", hospital: row.hospital ?? "" });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editing === "new") await api("/api/doctors", { json: draft });
      else if (editing) await api(`/api/doctors/${editing.id}`, { method: "PATCH", json: draft });
      toast(editing === "new" ? "Doctor added." : "Changes saved.");
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing || editing === "new") return;
    setBusy(true);
    try {
      await api(`/api/doctors/${editing.id}`, { method: "DELETE" });
      toast("Removed from the list.");
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: Row) => {
    setToggling(row.id);
    try {
      await api(`/api/doctors/${row.id}`, { method: "PATCH", json: { active: !row.active } });
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setToggling(null);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            className={cx(inputClass, "border-transparent bg-paper pl-9 hover:border-line focus:bg-surface")}
            placeholder="Search name, email, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg bg-paper p-0.5">
          {(["all", "active", "paused"] as Filter[]).map((f) => (
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
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => openEditor("new")}>
          Add doctor
        </Button>
      </div>

      <div className="scroll-quiet max-h-[calc(100vh-300px)] min-h-40 overflow-auto">
        <table className="w-full text-left text-[13.5px] whitespace-nowrap">
          <thead className="sticky top-0 z-10 bg-surface text-[12px] text-muted">
            <tr className="shadow-[inset_0_-1px_0_var(--color-line)]">
              <th className="px-5 py-2.5 font-normal">Name</th>
              <th className="px-3 py-2.5 font-normal">Email</th>
              <th className="px-3 py-2.5 font-normal">Specialty</th>
              <th className="px-3 py-2.5 font-normal">City</th>
              <th className="px-3 py-2.5 font-normal">Hospital</th>
              <th className="px-3 py-2.5 font-normal">Receives</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((d) => (
              <tr key={d.id} className={cx("group transition-colors hover:bg-paper/50", !d.active && "text-muted")}>
                <td className="px-5 py-2.5 font-medium">{d.name || <span className="font-normal text-faint">No name</span>}</td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink-2">{d.email}</td>
                <td className="px-3 py-2.5 text-ink-2">{d.specialty ?? <Dash />}</td>
                <td className="px-3 py-2.5 text-ink-2">{d.city ?? <Dash />}</td>
                <td className="max-w-52 truncate px-3 py-2.5 text-ink-2">{d.hospital ?? <Dash />}</td>
                <td className="px-3 py-2.5">
                  <Switch on={d.active} busy={toggling === d.id} onChange={() => toggle(d)} label={`Send emails to ${d.email}`} />
                </td>
                <td className="pr-3">
                  <button
                    onClick={() => openEditor(d)}
                    className="rounded-md p-1.5 text-faint opacity-0 transition group-hover:opacity-100 hover:bg-paper-deep hover:text-ink focus:opacity-100"
                    aria-label={`Edit ${d.email}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-5 py-10 text-center text-[13.5px] text-muted">No doctors match.</p>}
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add a doctor" : "Edit doctor"}
        description={editing === "new" ? "They'll receive the next scheduled article." : "Remember to update your Excel sheet too, so the next upload keeps this change."}
        footer={
          <>
            {editing !== "new" && (
              <Button variant="danger" className="mr-auto" onClick={remove} disabled={busy}>
                Remove
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={save}>
              {editing === "new" ? "Add doctor" : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Email" htmlFor="d-email">
              <input id="d-email" type="email" className={inputClass} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} autoFocus />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Name" htmlFor="d-name" hint="Fills {{name}} if the message uses it.">
              <input id="d-name" className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Dr. Ananya Rao" />
            </Field>
          </div>
          <Field label="Specialty" htmlFor="d-spec" optional>
            <input id="d-spec" className={inputClass} value={draft.specialty} onChange={(e) => setDraft({ ...draft, specialty: e.target.value })} />
          </Field>
          <Field label="City" htmlFor="d-city" optional>
            <input id="d-city" className={inputClass} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <Field label="Hospital" htmlFor="d-hosp" optional>
              <input id="d-hosp" className={inputClass} value={draft.hospital} onChange={(e) => setDraft({ ...draft, hospital: e.target.value })} />
            </Field>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

const Dash = () => <span className="text-faint">—</span>;

function Switch({ on, onChange, busy, label }: { on: boolean; onChange: () => void; busy?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onChange}
      className={cx("relative h-[18px] w-8 rounded-full transition-colors disabled:opacity-60", on ? "bg-pine" : "bg-line-strong")}
    >
      <span className={cx("absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-[left]", on ? "left-[16px]" : "left-[2px]")} />
    </button>
  );
}
