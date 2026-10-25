import type { ArticleStatus, DeliveryStatus, RunKind, RunStatus } from "@/lib/db/schema";
import { Pill, type Tone } from "./ui";

const article: Record<ArticleStatus, [string, Tone]> = {
  active: ["Scheduled", "pine"],
  paused: ["Paused", "amber"],
  completed: ["Finished", "stone"],
};

const run: Record<RunStatus, [string, Tone]> = {
  queued: ["Queued", "stone"],
  sending: ["Sending", "sky"],
  completed: ["Delivered", "pine"],
  partial: ["Partly failed", "amber"],
  failed: ["Failed", "brick"],
  missed: ["Missed", "stone"],
  cancelled: ["Stopped", "stone"],
};

const delivery: Record<DeliveryStatus, [string, Tone]> = {
  pending: ["Waiting", "stone"],
  sending: ["Sending", "sky"],
  sent: ["Sent", "pine"],
  failed: ["Failed", "brick"],
  cancelled: ["Stopped", "stone"],
};

export function ArticleStatusPill({ status }: { status: ArticleStatus }) {
  const [label, tone] = article[status];
  return <Pill tone={tone}>{label}</Pill>;
}

export function RunStatusPill({ status }: { status: RunStatus }) {
  const [label, tone] = run[status];
  return (
    <Pill tone={tone} live={status === "sending" || status === "queued"}>
      {label}
    </Pill>
  );
}

export function DeliveryStatusPill({ status }: { status: DeliveryStatus }) {
  const [label, tone] = delivery[status];
  return (
    <Pill tone={tone} live={status === "sending"}>
      {label}
    </Pill>
  );
}

export const runKindLabel: Record<RunKind, string> = {
  scheduled: "Scheduled",
  manual: "Sent now",
  test: "Test",
};

export const isLive = (status: RunStatus) => status === "queued" || status === "sending";
