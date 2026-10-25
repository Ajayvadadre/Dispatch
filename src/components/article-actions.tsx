"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Pause, Pencil, Play, Send, Trash2 } from "lucide-react";
import type { ArticleStatus } from "@/lib/db/schema";
import { api, errorMessage } from "./client";
import { Dialog } from "./dialog";
import { toast } from "./toast";
import { Button, Field, inputClass, LinkButton } from "./ui";

export function ArticleActions({
  id,
  title,
  status,
  doctorCount,
  defaultTestEmail,
}: {
  id: number;
  title: string;
  status: ArticleStatus;
  doctorCount: number;
  defaultTestEmail: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"test" | "send" | "delete" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [testName, setTestName] = useState("");

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done);
      setDialog(null);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const action = (body: Record<string, unknown>) => api(`/api/articles/${id}/actions`, { json: body });

  return (
    <>
      <Button icon={<FlaskConical className="size-4" />} onClick={() => setDialog("test")}>
        Send test
      </Button>
      {status === "paused" ? (
        <Button icon={<Play className="size-4" />} loading={busy === "resume"} onClick={() => act("resume", () => action({ action: "resume" }), "Schedule resumed.")}>
          Resume
        </Button>
      ) : status === "active" ? (
        <Button icon={<Pause className="size-4" />} loading={busy === "pause"} onClick={() => act("pause", () => action({ action: "pause" }), "Schedule paused.")}>
          Pause
        </Button>
      ) : null}
      <LinkButton href={`/articles/${id}/edit`} icon={<Pencil className="size-4" />}>
        Edit
      </LinkButton>
      <Button variant="ghost" aria-label="Delete article" onClick={() => setDialog("delete")}>
        <Trash2 className="size-4" />
      </Button>
      <Button variant="accent" icon={<Send className="size-4" />} onClick={() => setDialog("send")}>
        Send now
      </Button>

      <Dialog
        open={dialog === "test"}
        onClose={() => setDialog(null)}
        title="Send a test email"
        description="Only this address receives it, with the PDF attached, exactly as doctors will see it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy === "test"}
              onClick={() => act("test", () => action({ action: "test", email: testEmail, name: testName }), `Test sent to ${testEmail}.`)}
            >
              Send test
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Send to" htmlFor="testEmail">
            <input id="testEmail" type="email" className={inputClass} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@yourclinic.com" autoFocus />
          </Field>
          <Field label="Name" htmlFor="testName" optional hint='Fills {{name}} if the message uses it (blank shows "Doctor").'>
            <input id="testName" className={inputClass} value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Dr. Ananya Rao" />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "send"}
        onClose={() => setDialog(null)}
        title="Send to everyone now?"
        description={`"${title}" will be emailed to ${doctorCount.toLocaleString("en-IN")} active doctors, one email each. The schedule stays as it is.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              icon={<Send className="size-4" />}
              loading={busy === "send"}
              disabled={doctorCount === 0}
              onClick={() =>
                act(
                  "send",
                  async () => {
                    const { runId } = await action({ action: "send-now" });
                    router.push(`/activity/${runId}`);
                  },
                  "Sending started.",
                )
              }
            >
              Send to {doctorCount.toLocaleString("en-IN")} doctors
            </Button>
          </>
        }
      >
        {doctorCount === 0 ? (
          <p className="text-[13.5px] text-brick">There are no active doctors on the list yet. Upload the doctors sheet first.</p>
        ) : (
          <p className="text-[13.5px] text-muted">You can watch progress live and stop the send at any point.</p>
        )}
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Delete this article?"
        description="The PDF, schedule and send history for this article will be removed. Emails already delivered are not affected."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={busy === "delete"}
              onClick={() =>
                act(
                  "delete",
                  async () => {
                    await api(`/api/articles/${id}`, { method: "DELETE" });
                    router.push("/articles");
                  },
                  "Article deleted.",
                )
              }
            >
              Delete article
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-ink-2">“{title}”</p>
      </Dialog>
    </>
  );
}
