import type { DeckSettings, LaneKey, DeckState, Thread, ThreadSource, ThreadStatus, ThreadWhere } from "./types";

const STORAGE_KEY = "attention-loop.v1";
const LEGACY_KEYS = ["session-deck.v2", "session-deck.current"];

const statusSet: ThreadStatus[] = ["now", "running", "done", "waiting", "later"];
const sourceSet: ThreadSource[] = ["manual", "codex", "github", "browser"];
const laneKeys: LaneKey[] = ["focus", "agents", "ready", "waiting", "triage"];

export const defaultSettings: DeckSettings = {
  projects: [],
  laneLabels: {
    focus: "Focus",
    agents: "Agents",
    ready: "Brainstorming",
    waiting: "Waiting",
    triage: "Triage Shelf",
  },
  tags: ["brainstorm", "review", "sprint"],
};

function makeDefaultSettings(): DeckSettings {
  return {
    projects: [...defaultSettings.projects],
    laneLabels: { ...defaultSettings.laneLabels },
    tags: [...defaultSettings.tags],
  };
}

const legacyStatusMap: Record<string, ThreadStatus> = {
  now: "now",
  running: "running",
  waiting: "waiting",
  browser_waiting: "waiting",
  needs_me: "waiting",
  done: "done",
  later: "later",
  todo: "later",
  parked: "later",
  brainstorming: "later",
};

export const emptyDeck: DeckState = {
  threads: [],
  inboxProject: "Inbox",
  settings: makeDefaultSettings(),
};

function freshEmptyDeck(): DeckState {
  return {
    threads: [],
    inboxProject: "Inbox",
    settings: makeDefaultSettings(),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => asText(item).trim()).filter(Boolean)
    : [];
}

function normalizeSettings(value: unknown): DeckSettings {
  const record = asRecord(value);
  const laneRecord = asRecord(record.laneLabels);
  const lanes = { ...defaultSettings.laneLabels };

  for (const key of laneKeys) {
    const label = asText(laneRecord[key]).trim();
    if (label) lanes[key] = label;
  }
  if (lanes.ready === "Ready") lanes.ready = "Brainstorming";

  const projects = (Array.isArray(record.projects) ? record.projects : [])
    .map((item) => {
      const project = asRecord(item);
      const name = asText(project.name).trim();
      const color = asText(project.color).trim();
      if (!name) return null;
      return { name, color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#4c5f87" };
    })
    .filter((item): item is { name: string; color: string } => Boolean(item));

  return {
    projects,
    laneLabels: lanes,
    tags: asStringArray(record.tags).length > 0 ? asStringArray(record.tags) : [...defaultSettings.tags],
  };
}

function normalizeStatus(value: unknown): ThreadStatus {
  const raw = asText(value);
  if (statusSet.includes(raw as ThreadStatus)) return raw as ThreadStatus;
  return legacyStatusMap[raw] ?? "later";
}

function normalizeSource(value: unknown): ThreadSource {
  const raw = asText(value);
  return sourceSet.includes(raw as ThreadSource) ? (raw as ThreadSource) : "manual";
}

function normalizeWhere(value: unknown): ThreadWhere {
  const raw = asText(value).trim();
  if (!raw) return "";
  if (/^codex$/i.test(raw)) return "Codex";
  if (/^(chatgpt|chat gpt|browser\/chatgpt)$/i.test(raw)) return "Browser/ChatGPT";
  if (/^(claude|browser\/claude)$/i.test(raw)) return "Browser/Claude";
  if (/^cowork$/i.test(raw)) return "Cowork";
  if (/^(vscode|vs code)$/i.test(raw)) return "VSCode";
  return raw;
}

function normalizeThread(value: unknown): Thread | null {
  const record = asRecord(value);
  const title = asText(record.title).trim();
  if (!title) return null;

  const now = new Date().toISOString();
  const updatedAt = asText(record.updatedAt) || asText(record.lastTouched) || now;
  const rawWhere = asText(record.where) || asText(record.location);
  const where = normalizeWhere(rawWhere);
  const notes = asText(record.notes);

  return {
    id: asText(record.id) || crypto.randomUUID(),
    title,
    project: asText(record.project) || asText(record.category) || asText(record.area) || "Inbox",
    status: normalizeStatus(record.status),
    source: normalizeSource(record.source),
    where,
    notes,
    waitingOn: asText(record.waitingOn),
    enteredStatusAt: asText(record.enteredStatusAt) || updatedAt,
    createdAt: asText(record.createdAt) || updatedAt,
    updatedAt,
    archived: asBool(record.archived),
  };
}

function fromLegacy(parsed: Record<string, unknown>): Thread[] {
  const raw = Array.isArray(parsed.threads)
    ? parsed.threads
    : Array.isArray(parsed.tasks)
      ? parsed.tasks
      : [];
  return raw.map(normalizeThread).filter((t): t is Thread => Boolean(t));
}

function normalizeDeck(value: unknown): DeckState {
  const parsed = asRecord(value);
  const threads = (Array.isArray(parsed.threads) ? parsed.threads : [])
    .map(normalizeThread)
    .filter((t): t is Thread => Boolean(t));

  return {
    threads,
    inboxProject: asText(parsed.inboxProject) || "Inbox",
    settings: normalizeSettings(parsed.settings),
  };
}

function loadFromBrowserStorage(): DeckState | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return normalizeDeck(JSON.parse(stored));
    } catch {
      return null;
    }
  }

  for (const key of LEGACY_KEYS) {
    const legacy = window.localStorage.getItem(key);
    if (!legacy) continue;
    try {
      return { threads: fromLegacy(asRecord(JSON.parse(legacy))), inboxProject: "Inbox", settings: makeDefaultSettings() };
    } catch {
      return null;
    }
  }

  return null;
}

export async function loadDeck(): Promise<DeckState> {
  const desktopStorage = window.attentionLoopStorage;

  if (desktopStorage) {
    try {
      const stored = await desktopStorage.load();
      if (stored) return normalizeDeck(stored);
    } catch {
      // Fall through to browser storage; the app should still be usable.
    }
  }

  const browserDeck = loadFromBrowserStorage();
  if (browserDeck) {
    if (desktopStorage) await desktopStorage.save(browserDeck);
    return browserDeck;
  }

  return freshEmptyDeck();
}

export async function saveDeck(deck: DeckState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
  if (window.attentionLoopStorage) await window.attentionLoopStorage.save(deck);
}

export async function clearDeck() {
  window.localStorage.removeItem(STORAGE_KEY);
  for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  if (window.attentionLoopStorage) await window.attentionLoopStorage.clear();
}
