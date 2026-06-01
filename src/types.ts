export type ThreadStatus = "now" | "running" | "done" | "waiting" | "later";

export type ThreadSource = "manual" | "codex" | "github" | "browser";

export type ThreadWhere = string;

export type ThreadOwner = "you" | "agent" | "waiting";

export type LaneKey = "focus" | "agents" | "ready" | "waiting" | "triage";

export type ProjectSetting = {
  name: string;
  color: string;
};

export type DeckSettings = {
  projects: ProjectSetting[];
  laneLabels: Record<LaneKey, string>;
  tags: string[];
};

export type Thread = {
  id: string;
  title: string;
  project: string;
  status: ThreadStatus;
  source: ThreadSource;
  where: ThreadWhere;
  notes: string;
  waitingOn: string;
  enteredStatusAt: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export type DeckState = {
  threads: Thread[];
  inboxProject: string;
  settings: DeckSettings;
};

/** Derived, never stored. A running thread that has been quiet too long. */
export type DerivedFlag = "stalled" | "wait-overdue" | "needs-confirm" | null;

export const STALL_MINS = 30;
export const WAIT_STALE_DAYS = 2;
export const SWEEP_DAYS = 7;

export function ownerOf(status: ThreadStatus): ThreadOwner {
  if (status === "running" || status === "done") return "agent";
  if (status === "waiting") return "waiting";
  return "you";
}

export function minutesSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / 60000));
}

export function daysSince(iso: string): number {
  return minutesSince(iso) / (60 * 24);
}

/** The whole anti-stale engine in one pure function. */
export function flagOf(thread: Thread): DerivedFlag {
  if (thread.status === "running" && minutesSince(thread.enteredStatusAt) >= STALL_MINS) {
    return "stalled";
  }
  if (thread.status === "done") {
    return "needs-confirm";
  }
  if (thread.status === "waiting" && daysSince(thread.enteredStatusAt) >= WAIT_STALE_DAYS) {
    return "wait-overdue";
  }
  return null;
}

/** A later-thread that has gone untouched long enough to auto-sweep. */
export function isSweepable(thread: Thread): boolean {
  return thread.status === "later" && !thread.archived && daysSince(thread.updatedAt) >= SWEEP_DAYS;
}
