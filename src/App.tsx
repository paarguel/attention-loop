import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  FolderPlus,
  Inbox,
  Loader,
  Pencil,
  Play,
  Plus,
  SlidersHorizontal,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { defaultProjects, matchProject } from "./projects";
import { clearDeck, emptyDeck, loadDeck, saveDeck } from "./storage";
import {
  daysSince,
  flagOf,
  isSweepable,
  minutesSince,
  ownerOf,
  type DeckState,
  type DeckSettings,
  type LaneKey,
  type ProjectSetting,
  type Thread,
  type ThreadSource,
  type ThreadStatus,
  type ThreadWhere,
} from "./types";

type View = "full" | "settings";

const statusOptions: Array<{ value: ThreadStatus; label: string }> = [
  { value: "now", label: "Now" },
  { value: "running", label: "Running" },
  { value: "done", label: "Done" },
  { value: "waiting", label: "Waiting" },
  { value: "later", label: "Later" },
];

const defaultWhereOptions: Array<{ value: ThreadWhere; label: string }> = [
  { value: "", label: "Unplaced" },
  { value: "Codex", label: "Codex" },
  { value: "Browser/ChatGPT", label: "Browser/ChatGPT" },
  { value: "Browser/Claude", label: "Browser/Claude" },
  { value: "Cowork", label: "Cowork" },
  { value: "VSCode", label: "VSCode" },
];

const laneOrder: LaneKey[] = ["focus", "agents", "ready", "waiting", "triage"];

const laneMeta: Record<LaneKey, { rule: string; tokens: string[] }> = {
  focus: { rule: "Active human work", tokens: ["now"] },
  agents: { rule: "Delegated or returned", tokens: ["running", "done"] },
  ready: { rule: "Parked thinking threads", tokens: ["browser", "ChatGPT", "Claude"] },
  waiting: { rule: "External blockers", tokens: ["waiting"] },
  triage: { rule: "Parked backlog", tokens: ["later"] },
};

type CaptureDraft = {
  project: string;
  title: string;
  status: ThreadStatus;
  source: ThreadSource;
  where: ThreadWhere;
  usedDefaultProject: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function makeThread(draft: CaptureDraft): Thread {
  const ts = nowIso();
  return {
    id: crypto.randomUUID(),
    title: draft.title,
    project: draft.project,
    status: draft.status,
    source: draft.source,
    where: draft.where,
    notes: "",
    waitingOn: "",
    enteredStatusAt: ts,
    createdAt: ts,
    updatedAt: ts,
    archived: false,
  };
}

function parseCaptureHome(line: string, knownProjects: string[], inbox: string): { project: string; title: string; usedDefaultProject: boolean } {
  const bracket = line.match(/^\[([^\]]{1,40})\]\s*(.+)$/);
  if (bracket) return { project: matchProject(bracket[1], knownProjects), title: bracket[2].trim(), usedDefaultProject: false };

  const colon = line.match(/^([^:]{2,40}):\s*(.+)$/);
  if (colon && !colon[1].includes("/")) {
    return { project: matchProject(colon[1], knownProjects), title: colon[2].trim(), usedDefaultProject: false };
  }

  const comma = line.match(/^([^,]{2,40}),\s*(.+)$/);
  if (comma && matchProject(comma[1], knownProjects) !== comma[1].trim()) {
    return { project: matchProject(comma[1], knownProjects), title: comma[2].trim(), usedDefaultProject: false };
  }

  return { project: inbox, title: line.trim(), usedDefaultProject: true };
}

function cleanDraftTitle(title: string): string {
  const withoutTool = title
    .replace(/\b(?:in|with|on)\s+(codex|chatgpt|chat gpt|github|browser)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const withoutLeadingVerb = withoutTool
    .replace(/^(doing|working on|running|drafting|reviewing)\s+/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return withoutLeadingVerb || withoutTool || title.trim();
}

function toolAttributes(title: string): Pick<CaptureDraft, "status" | "source" | "where"> {
  const lower = title.toLowerCase();
  if (/\bcodex\b/.test(lower)) return { status: "running", source: "codex", where: "Codex" };
  if (/\bchat\s*gpt\b|\bchatgpt\b/.test(lower)) return { status: "later", source: "browser", where: "Browser/ChatGPT" };
  if (/\bclaude\b/.test(lower)) return { status: "later", source: "browser", where: "Browser/Claude" };
  if (/\bvs\s*code\b|\bvscode\b/.test(lower)) return { status: "later", source: "manual", where: "VSCode" };
  if (/\bcowork\b/.test(lower)) return { status: "later", source: "manual", where: "Cowork" };
  if (/\bgithub\b|\bpr\b|\bci\b/.test(lower)) return { status: "waiting", source: "github", where: "" };
  return { status: "later", source: "manual", where: "" };
}

function splitSmartClauses(title: string): string[] {
  const clauses = title
    .split(/\s+(?:and|&|\+)\s+(?=(?:doing|working on|running|brainstorming|drafting|reviewing)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return clauses.length > 0 ? clauses : [title];
}

function parseCapture(line: string, knownProjects: string[], inbox: string): CaptureDraft[] {
  const home = parseCaptureHome(line, knownProjects, inbox);
  return splitSmartClauses(home.title).map((clause) => {
    const attrs = toolAttributes(clause);
    return {
      project: home.project,
      title: cleanDraftTitle(clause) || clause,
      usedDefaultProject: home.usedDefaultProject,
      ...attrs,
    };
  });
}

function sourceLabel(source: ThreadSource, where: string): string {
  if (where) return where;
  if (source === "codex") return "Codex";
  if (source === "github") return "GitHub";
  if (source === "browser") return "Browser";
  return "Manual";
}

function sourceFromWhere(where: ThreadWhere): ThreadSource {
  const lower = where.toLowerCase();
  if (lower === "codex") return "codex";
  if (/\bbrowser\b|\bchatgpt\b|\bchat gpt\b|\bclaude\b/.test(lower)) return "browser";
  return "manual";
}

function isBrainstormThread(thread: Thread): boolean {
  const text = `${thread.title} ${thread.where} ${thread.notes}`.toLowerCase();
  return thread.source === "browser" || /\b(chatgpt|chat gpt|claude|browser|brainstorm|obsidian)\b/.test(text);
}

const projectColorMap: Record<string, { color: string; bg: string }> = {
  AttentionLoop: { color: "#534ab7", bg: "#eeedfe" },
  Inbox: { color: "#63615b", bg: "#efeeeb" },
  Work: { color: "#0b6f6a", bg: "#dff5f1" },
  Career: { color: "#2563a8", bg: "#e5f0fb" },
  Personal: { color: "#6a5a2b", bg: "#f3edd8" },
  Research: { color: "#9b3f71", bg: "#f8e6f0" },
  Writing: { color: "#7a4fb3", bg: "#f0e8fb" },
  Learning: { color: "#3f6f2a", bg: "#e7f2df" },
};

const fallbackProjectColors = [
  { color: "#4c5f87", bg: "#e8edf5" },
  { color: "#8a4b12", bg: "#f7eadc" },
  { color: "#0f766e", bg: "#def7f2" },
  { color: "#9f3a3a", bg: "#f8e5e5" },
  { color: "#5d6f1f", bg: "#edf2d9" },
];

function tintFromHex(hex: string): string {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#4c5f87";
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * 0.86)} ${Math.round(g + (255 - g) * 0.86)} ${Math.round(b + (255 - b) * 0.86)})`;
}

function projectColor(project: string, settingsProjects: ProjectSetting[] = []): { color: string; bg: string } {
  const custom = settingsProjects.find((p) => p.name === project);
  if (custom) return { color: custom.color, bg: tintFromHex(custom.color) };

  const known = projectColorMap[project];
  if (known) return known;

  const index = [...project].reduce((total, char) => total + char.charCodeAt(0), 0) % fallbackProjectColors.length;
  return fallbackProjectColors[index];
}

function statusVisual(thread: Thread) {
  const flag = flagOf(thread);
  if (flag === "stalled") return { Icon: AlertTriangle, tone: "danger", label: `stalled ${minutesSince(thread.enteredStatusAt)}m` };
  if (flag === "needs-confirm") return { Icon: Check, tone: "success", label: "done - check it" };
  if (flag === "wait-overdue") return { Icon: AlertTriangle, tone: "warning", label: `blocked ${Math.floor(daysSince(thread.enteredStatusAt))}d` };

  switch (thread.status) {
    case "now":
      return { Icon: Play, tone: "primary", label: "now" };
    case "running":
      return { Icon: Loader, tone: "agent", label: `running ${minutesSince(thread.enteredStatusAt)}m` };
    case "done":
      return { Icon: Check, tone: "success", label: "done" };
    case "waiting":
      return { Icon: Clock3, tone: "waiting", label: thread.waitingOn ? `waiting - ${thread.waitingOn}` : "waiting" };
    default:
      return { Icon: Circle, tone: "muted", label: "later" };
  }
}

function sortByUpdated(threads: Thread[]): Thread[] {
  return [...threads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function StatusLine({
  thread,
  visual,
  action,
  settingsProjects = [],
}: {
  thread: Thread;
  visual: ReturnType<typeof statusVisual>;
  action?: ReactNode;
  settingsProjects?: ProjectSetting[];
}) {
  const colors = projectColor(thread.project, settingsProjects);
  const style = {
    "--project-color": colors.color,
    "--project-bg": colors.bg,
  } as CSSProperties;

  return (
    <div className={`status-line tone-${visual.tone} ${action ? "has-action" : ""}`} style={style}>
      <span className="status-line-icon" aria-hidden="true">
        <visual.Icon size={14} />
      </span>
      <div className="status-line-body">
        <span className="status-line-project">{thread.project}</span>
        <span className="status-line-title">{thread.title}</span>
        <span className="status-line-meta">
          <span>{sourceLabel(thread.source, thread.where)}</span>
          <span>{visual.label}</span>
        </span>
      </div>
      {action ? <div className="status-line-action">{action}</div> : null}
    </div>
  );
}

function DashboardTask({
  thread,
  visual,
  projectOptions,
  whereOptions,
  settingsProjects,
  onStatus,
  onPatch,
  onDelete,
  onAddProject,
  children,
}: {
  thread: Thread;
  visual: ReturnType<typeof statusVisual>;
  projectOptions: string[];
  whereOptions: string[];
  settingsProjects: ProjectSetting[];
  onStatus: (id: string, status: ThreadStatus) => void;
  onPatch: (id: string, patch: Partial<Thread>) => void;
  onDelete: (id: string) => void;
  onAddProject: (name: string) => void;
  children?: ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [isAddingWhere, setIsAddingWhere] = useState(false);
  const [whereDraft, setWhereDraft] = useState("");

  function commitProject() {
    const name = projectDraft.trim();
    if (!name) return;
    onAddProject(name);
    onPatch(thread.id, { project: name });
    setProjectDraft("");
    setIsAddingProject(false);
  }

  function commitWhere() {
    const where = whereDraft.trim();
    if (!where) return;
    onPatch(thread.id, { where, source: sourceFromWhere(where) });
    setWhereDraft("");
    setIsAddingWhere(false);
  }

  return (
    <div className={`dashboard-task ${isEditing ? "is-editing" : ""}`}>
      <StatusLine
        thread={thread}
        visual={visual}
        settingsProjects={settingsProjects}
        action={
          <>
            {children}
            <button className="summary-action" type="button" onClick={() => setIsEditing((open) => !open)} title="Edit task" aria-label="Edit task">
              {isEditing ? <X size={14} /> : <SlidersHorizontal size={14} />}
            </button>
          </>
        }
      />
      {isEditing ? (
        <div className="summary-editor">
          <label className="editor-title">
            <span>Task</span>
            <textarea
              value={thread.title}
              onChange={(e) => onPatch(thread.id, { title: e.target.value })}
              rows={2}
              aria-label="Task title"
            />
          </label>
          <div className="summary-editor-grid">
            <label>
              <span>Project</span>
              <select
                value={isAddingProject ? "__new_project__" : thread.project}
                onChange={(e) => {
                  if (e.target.value === "__new_project__") {
                    setIsAddingProject(true);
                    return;
                  }
                  setIsAddingProject(false);
                  onPatch(thread.id, { project: e.target.value });
                }}
                aria-label="Project"
              >
                {Array.from(new Set([thread.project, ...projectOptions])).map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
                <option value="__new_project__">+ New project...</option>
              </select>
              {isAddingProject ? (
                <div className="quick-add-row">
                  <input
                    value={projectDraft}
                    onChange={(e) => setProjectDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitProject();
                      if (e.key === "Escape") {
                        setIsAddingProject(false);
                        setProjectDraft("");
                      }
                    }}
                    placeholder="Project name"
                    aria-label="New project name"
                    autoFocus
                  />
                  <button className="chip-btn" type="button" onClick={commitProject} disabled={!projectDraft.trim()}>
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              ) : null}
            </label>
            <label>
              <span>Where</span>
              <select
                value={isAddingWhere ? "__new_where__" : thread.where}
                onChange={(e) => {
                  if (e.target.value === "__new_where__") {
                    setIsAddingWhere(true);
                    return;
                  }
                  const where = e.target.value as ThreadWhere;
                  setIsAddingWhere(false);
                  onPatch(thread.id, { where, source: sourceFromWhere(where) });
                }}
                aria-label="Where"
              >
                {Array.from(new Set([thread.where, ...whereOptions])).map((where) => (
                  <option key={where || "empty"} value={where}>
                    {where || "Unplaced"}
                  </option>
                ))}
                <option value="__new_where__">+ New place...</option>
              </select>
              {isAddingWhere ? (
                <div className="quick-add-row">
                  <input
                    value={whereDraft}
                    onChange={(e) => setWhereDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitWhere();
                      if (e.key === "Escape") {
                        setIsAddingWhere(false);
                        setWhereDraft("");
                      }
                    }}
                    placeholder="Place name"
                    aria-label="New place name"
                    autoFocus
                  />
                  <button className="chip-btn" type="button" onClick={commitWhere} disabled={!whereDraft.trim()}>
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              ) : null}
            </label>
            <label>
              <span>Status</span>
              <select value={thread.status} onChange={(e) => onStatus(thread.id, e.target.value as ThreadStatus)} aria-label="Status">
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>Waiting On</span>
            <input
              value={thread.waitingOn}
              onChange={(e) => onPatch(thread.id, { waitingOn: e.target.value })}
              placeholder="Person, reply, review, decision..."
              aria-label="Waiting on"
            />
          </label>
          <label>
            <span>Notes</span>
            <textarea
              value={thread.notes}
              onChange={(e) => onPatch(thread.id, { notes: e.target.value })}
              rows={3}
              placeholder="Link, handoff note, context, next move..."
              aria-label="Notes"
            />
          </label>
          <div className="summary-editor-actions">
            <button className="chip-btn chip-ok" type="button" onClick={() => setIsEditing(false)}>
              <Check size={13} />
              Done
            </button>
            <button className="chip-btn" type="button" onClick={() => onDelete(thread.id)}>
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const [deck, setDeck] = useState<DeckState>(emptyDeck);
  const [isHydrated, setIsHydrated] = useState(false);
  const [view, setView] = useState<View>("full");
  const [capture, setCapture] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [newProject, setNewProject] = useState("");
  const [newTag, setNewTag] = useState("");
  const [waitingPromptId, setWaitingPromptId] = useState<string | null>(null);
  const [waitingDraft, setWaitingDraft] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    loadDeck().then((loaded) => {
      if (!active) return;
      setDeck(loaded);
      setIsHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) void saveDeck(deck);
  }, [deck, isHydrated]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const active = useMemo(() => deck.threads.filter((t) => !t.archived), [deck.threads]);
  const archived = useMemo(() => deck.threads.filter((t) => t.archived), [deck.threads]);
  const sweepable = useMemo(() => active.filter(isSweepable), [active]);
  const focusThread = useMemo(() => active.find((t) => t.status === "now"), [active]);
  const agentThreads = useMemo(() => sortByUpdated(active.filter((t) => t.status === "running" || t.status === "done")), [active]);
  const waitingThreads = useMemo(() => sortByUpdated(active.filter((t) => t.status === "waiting")), [active]);
  const brainstormThreads = useMemo(
    () => sortByUpdated(active.filter((t) => t.status === "later" && isBrainstormThread(t))),
    [active],
  );
  const parkedThreads = useMemo(
    () => sortByUpdated(active.filter((t) => t.status === "later" && !isBrainstormThread(t))),
    [active],
  );
  const knownProjects = useMemo(
    () => Array.from(new Set([...defaultProjects(), ...deck.settings.projects.map((p) => p.name), ...deck.threads.map((t) => t.project)])).sort(),
    [deck.settings.projects, deck.threads],
  );
  const knownWhere = useMemo(
    () =>
      Array.from(new Set([...defaultWhereOptions.map((option) => option.value), ...deck.threads.map((t) => t.where).filter(Boolean)])).sort((a, b) => {
        if (!a) return -1;
        if (!b) return 1;
        return a.localeCompare(b);
      }),
    [deck.threads],
  );
  const projectRows = useMemo(
    () =>
      knownProjects.map((project) => ({
        name: project,
        color: projectColor(project, deck.settings.projects).color,
        count: deck.threads.filter((t) => !t.archived && t.project === project).length,
      })),
    [deck.settings.projects, deck.threads, knownProjects],
  );
  const captureDrafts = useMemo(() => {
    const lines = capture
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.flatMap((line) => parseCapture(line, knownProjects, deck.inboxProject));
  }, [capture, deck.inboxProject, knownProjects]);

  function patchThread(id: string, patch: Partial<Thread>) {
    setDeck((d) => ({
      ...d,
      threads: d.threads.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t)),
    }));
  }

  function patchSettings(patch: Partial<DeckSettings>) {
    setDeck((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }

  function upsertProjectSetting(name: string, patch: Partial<ProjectSetting>) {
    const cleanName = (patch.name ?? name).trim();
    if (!cleanName) return;

    setDeck((d) => {
      const current = d.settings.projects.find((p) => p.name === name) ?? {
        name,
        color: projectColor(name, d.settings.projects).color,
      };
      const nextProject = { ...current, ...patch, name: cleanName };
      const projects = [
        ...d.settings.projects.filter((p) => p.name !== name && p.name !== cleanName),
        nextProject,
      ].sort((a, b) => a.name.localeCompare(b.name));

      return {
        ...d,
        settings: { ...d.settings, projects },
        threads:
          cleanName !== name
            ? d.threads.map((t) => (t.project === name ? { ...t, project: cleanName, updatedAt: nowIso() } : t))
            : d.threads,
      };
    });
  }

  function renameProject(oldName: string, nextName: string) {
    const cleanName = nextName.trim();
    if (!cleanName || cleanName === oldName) return;

    setDeck((d) => {
      const existingSetting = d.settings.projects.find((p) => p.name === oldName);
      const nextProjects = existingSetting
        ? [
            ...d.settings.projects.filter((p) => p.name !== oldName && p.name !== cleanName),
            { ...existingSetting, name: cleanName },
          ].sort((a, b) => a.name.localeCompare(b.name))
        : d.settings.projects;

      return {
        ...d,
        settings: { ...d.settings, projects: nextProjects },
        threads: d.threads.map((t) => (t.project === oldName ? { ...t, project: cleanName, updatedAt: nowIso() } : t)),
      };
    });
  }

  function addProject() {
    const name = newProject.trim();
    if (!name) return;
    upsertProjectSetting(name, { name, color: projectColor(name).color });
    setNewProject("");
  }

  function patchLaneLabel(key: LaneKey, label: string) {
    patchSettings({ laneLabels: { ...deck.settings.laneLabels, [key]: label } });
  }

  function addTag() {
    const tag = newTag.trim().replace(/^#/, "");
    if (!tag || deck.settings.tags.includes(tag)) return;
    patchSettings({ tags: [...deck.settings.tags, tag].sort() });
    setNewTag("");
  }

  function removeTag(tag: string) {
    patchSettings({ tags: deck.settings.tags.filter((t) => t !== tag) });
  }

  function setStatus(id: string, status: ThreadStatus) {
    setDeck((d) => ({
      ...d,
      threads: d.threads.map((t) =>
        t.id === id
          ? { ...t, status, enteredStatusAt: nowIso(), updatedAt: nowIso() }
          : status === "now" && t.status === "now"
            ? { ...t, status: "later", enteredStatusAt: nowIso(), updatedAt: nowIso() }
            : t,
      ),
    }));
  }

  function setFocus(id: string) {
    setStatus(id, "now");
  }

  function sendToAgent(id: string) {
    const ts = nowIso();
    setDeck((d) => ({
      ...d,
      threads: d.threads.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "running",
              source: "codex",
              where: t.where || "Codex",
              enteredStatusAt: ts,
              updatedAt: ts,
            }
          : t,
      ),
    }));
  }

  function parkBrainstorm(id: string) {
    const ts = nowIso();
    setDeck((d) => ({
      ...d,
      threads: d.threads.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "later",
              source: "browser",
              where: t.where || "Browser/ChatGPT",
              enteredStatusAt: ts,
              updatedAt: ts,
            }
          : t,
      ),
    }));
  }

  function moveToWaiting(id: string, waitingOn: string) {
    const cleanWaitingOn = waitingOn.trim();
    if (!cleanWaitingOn) return;
    const ts = nowIso();
    setDeck((d) => ({
      ...d,
      threads: d.threads.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "waiting",
              waitingOn: cleanWaitingOn,
              enteredStatusAt: ts,
              updatedAt: ts,
            }
          : t,
      ),
    }));
    setWaitingPromptId(null);
    setWaitingDraft("");
  }

  function startWaitingPrompt(id: string) {
    const thread = deck.threads.find((t) => t.id === id);
    setWaitingPromptId(id);
    setWaitingDraft(thread?.waitingOn ?? "");
  }

  function submitWaitingPrompt() {
    if (!waitingPromptId) return;
    moveToWaiting(waitingPromptId, waitingDraft);
  }

  function cancelWaitingPrompt() {
    setWaitingPromptId(null);
    setWaitingDraft("");
  }

  function addThread() {
    const lines = capture
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const made = lines.flatMap((line) => parseCapture(line, knownProjects, deck.inboxProject)).map(makeThread);
    setDeck((d) => ({ ...d, threads: [...made, ...d.threads] }));
    setCapture("");
  }

  function deleteThread(id: string) {
    setDeck((d) => ({ ...d, threads: d.threads.filter((t) => t.id !== id) }));
  }

  function sweepStale() {
    const ids = new Set(sweepable.map((t) => t.id));
    setDeck((d) => ({ ...d, threads: d.threads.map((t) => (ids.has(t.id) ? { ...t, archived: true } : t)) }));
  }

  function unarchive(id: string) {
    patchThread(id, { archived: false, status: "later", enteredStatusAt: nowIso() });
  }

  function resetAll() {
    if (!window.confirm("Clear every thread?")) return;
    void clearDeck();
    setDeck(emptyDeck);
  }

  function pulse(threads: Thread[]) {
    return {
      you: threads.filter((t) => ownerOf(t.status) === "you").length,
      agent: threads.filter((t) => ownerOf(t.status) === "agent").length,
      waiting: threads.filter((t) => ownerOf(t.status) === "waiting").length,
    };
  }

  function urgentLine(threads: Thread[]): { text: string; tone: string } {
    const done = threads.find((t) => t.status === "done");
    if (done) return { text: `${done.title} needs confirm`, tone: "success" };
    const stalled = threads.find((t) => flagOf(t) === "stalled");
    if (stalled) return { text: `${stalled.title} stalled ${minutesSince(stalled.enteredStatusAt)}m`, tone: "danger" };
    const overdue = threads.find((t) => flagOf(t) === "wait-overdue");
    if (overdue) return { text: `${overdue.title} blocked ${Math.floor(daysSince(overdue.enteredStatusAt))}d`, tone: "warning" };

    const counts = pulse(threads);
    if (counts.waiting > 0) return { text: "waiting", tone: "warning" };
    if (counts.agent > 0) return { text: "running", tone: "agent" };
    if (counts.you > 0) return { text: "for you", tone: "primary" };
    return { text: "later", tone: "muted" };
  }

  const totals = pulse(active);
  const needsAttention = agentThreads.filter((t) => flagOf(t) === "stalled" || flagOf(t) === "needs-confirm").length + waitingThreads.filter((t) => flagOf(t) === "wait-overdue").length;
  const laneLabels = deck.settings.laneLabels;

  return (
    <main className="deck">
      <datalist id="project-options">
        {knownProjects.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <header className="deck-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Play size={13} fill="currentColor" />
          </span>
          <h1>AttentionLoop</h1>
          <span className="brand-pulse" aria-label="Overall pulse">
            <span className="pp pp-you">{totals.you} you</span>
            <span className="pp pp-agent">{totals.agent} agents</span>
            <span className="pp pp-wait">{totals.waiting} waiting</span>
          </span>
        </div>
        <div className="header-actions">
          <div className="view-toggle" role="tablist" aria-label="View">
            <button className={view === "full" ? "on" : ""} type="button" onClick={() => setView("full")}>
              Full
            </button>
            <button className={view === "settings" ? "on" : ""} type="button" onClick={() => setView("settings")}>
              Settings
            </button>
          </div>
          <button
            className="icon-btn clear-btn"
            type="button"
            onClick={resetAll}
            title="Clear all threads"
            aria-label="Clear all threads"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <div className={`capture-shell ${captureDrafts.length > 0 ? "has-preview" : ""}`}>
        <div className="capture">
          <Inbox size={16} aria-hidden="true" className="capture-icon" />
          <input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addThread();
              }
            }}
            placeholder={`Capture one line - Work: draft launch notes (defaults to ${deck.inboxProject})`}
            aria-label="Quick capture"
          />
          <button className="primary-btn" type="button" onClick={addThread} disabled={!capture.trim()}>
            <Plus size={15} />
            Add
          </button>
        </div>
        {captureDrafts.length > 0 ? (
              <div className="capture-preview" aria-live="polite">
            {captureDrafts.map((draft, index) => (
              <div className="preview-draft" key={`${draft.project}-${draft.title}-${index}`}>
                <span className="preview-title">{draft.title}</span>
                <span className="preview-meta">
                  <span className="preview-chip">{sourceLabel(draft.source, draft.where)}</span>
                  <span className={`preview-chip preview-status preview-status-${draft.status}`}>{statusOptions.find((o) => o.value === draft.status)?.label}</span>
                  <span className="preview-chip preview-project">{draft.project}</span>
                  {draft.usedDefaultProject ? <span className="preview-note">Inbox default</span> : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {sweepable.length > 0 ? (
        <div className="sweep-bar">
          <span>
            {sweepable.length} parked thread{sweepable.length > 1 ? "s have" : " has"} gone quiet for a week.
          </span>
          <button type="button" onClick={sweepStale}>
            <Archive size={14} />
            Sweep to archive
          </button>
        </div>
      ) : null}

      {view === "settings" ? (
        <section className="settings" aria-label="Settings">
          <section className="settings-section" aria-label="Projects">
            <header className="settings-head">
              <span className="settings-icon"><FolderPlus size={15} /></span>
              <div>
                <h2>Projects</h2>
                <p>Color, naming, and capture homes.</p>
              </div>
            </header>
            <div className="settings-add-row">
              <input
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addProject();
                }}
                placeholder="New project"
                aria-label="New project"
              />
              <button className="chip-btn" type="button" onClick={addProject}>
                <Plus size={13} />
                Add project
              </button>
            </div>
            <ul className="settings-list project-settings-list">
              {projectRows.map((project) => (
                <li className="settings-row project-settings-row" key={project.name}>
                  <input
                    className="project-color"
                    type="color"
                    value={project.color}
                    onChange={(e) => upsertProjectSetting(project.name, { color: e.target.value })}
                    aria-label={`${project.name} color`}
                  />
                  <input
                    className="settings-name-input"
                    defaultValue={project.name}
                    onBlur={(e) => upsertProjectSetting(project.name, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-label={`${project.name} name`}
                  />
                  <span className="settings-count">{project.count} active</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="settings-section" aria-label="Lanes">
            <header className="settings-head">
              <span className="settings-icon"><SlidersHorizontal size={15} /></span>
              <div>
                <h2>Lanes</h2>
                <p>Dashboard labels and routing rules.</p>
              </div>
            </header>
            <ul className="settings-list lane-settings-list">
              {laneOrder.map((lane) => (
                <li className="settings-row lane-settings-row" key={lane}>
                  <input
                    className="settings-name-input"
                    value={deck.settings.laneLabels[lane]}
                    onChange={(e) => patchLaneLabel(lane, e.target.value)}
                    aria-label={`${lane} label`}
                  />
                  <span className="lane-rule">{laneMeta[lane].rule}</span>
                  <span className="lane-tokens">
                    {laneMeta[lane].tokens.map((token) => (
                      <span className="token-chip" key={token}>{token}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="settings-section" aria-label="Tags">
            <header className="settings-head">
              <span className="settings-icon"><Tags size={15} /></span>
              <div>
                <h2>Tags</h2>
                <p>Reusable capture labels.</p>
              </div>
            </header>
            <div className="settings-add-row">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTag();
                }}
                placeholder="New tag"
                aria-label="New tag"
              />
              <button className="chip-btn" type="button" onClick={addTag}>
                <Plus size={13} />
                Add tag
              </button>
            </div>
            <div className="tag-cloud">
              {deck.settings.tags.map((tag) => (
                <button className="tag-pill" type="button" key={tag} onClick={() => removeTag(tag)} title="Remove tag">
                  #{tag}
                </button>
              ))}
            </div>
          </section>
        </section>
      ) : active.length === 0 ? (
        <p className="empty-deck">Nothing in the oven. Capture a line above to start.</p>
      ) : (
        <section className="full" aria-label="Full view">
          <section className="command-board" aria-label="Session command board">
            <div className={`command-cell command-focus ${focusThread ? "" : "is-empty"}`}>
              <div className="command-label">{laneLabels.focus}</div>
              {focusThread ? (
                <>
                  <DashboardTask
                    thread={focusThread}
                    visual={statusVisual(focusThread)}
                    projectOptions={knownProjects}
                    whereOptions={knownWhere}
                    settingsProjects={deck.settings.projects}
                    onStatus={setStatus}
                    onPatch={patchThread}
                    onDelete={deleteThread}
                    onAddProject={(name) => upsertProjectSetting(name, { name, color: projectColor(name).color })}
                  >
                    <button className="summary-action bot-action" type="button" onClick={() => sendToAgent(focusThread.id)} title="Send focus to agent" aria-label="Send focus to agent">
                      <Bot size={14} />
                    </button>
                    <button className="summary-action brainstorm-action" type="button" onClick={() => parkBrainstorm(focusThread.id)} title="Park as brainstorming" aria-label="Park as brainstorming">
                      <Pencil size={14} />
                    </button>
                    <button className="summary-action waiting-action" type="button" onClick={() => startWaitingPrompt(focusThread.id)} title="Move to waiting" aria-label="Move to waiting">
                      <Clock3 size={14} />
                    </button>
                  </DashboardTask>
                  {waitingPromptId === focusThread.id ? (
                    <div className="waiting-prompt">
                      <input
                        value={waitingDraft}
                        onChange={(e) => setWaitingDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitWaitingPrompt();
                          if (e.key === "Escape") cancelWaitingPrompt();
                        }}
                        placeholder="Waiting on what?"
                        aria-label="Waiting on what"
                        autoFocus
                      />
                      <button className="chip-btn" type="button" onClick={submitWaitingPrompt} disabled={!waitingDraft.trim()}>
                        Save
                      </button>
                      <button className="icon-btn small" type="button" onClick={cancelWaitingPrompt} aria-label="Cancel waiting prompt">
                        <X size={13} />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="empty-command">No active focus. Pick one from the triage shelf.</div>
              )}
            </div>
            <div className={`command-cell ${agentThreads.length ? "" : "is-empty"}`}>
              <div className="command-label">{laneLabels.agents}</div>
              {agentThreads.length ? (
                <ul className="mini-thread-list">
                  {agentThreads.map((thread) => (
                    <li key={thread.id}>
                      <DashboardTask
                        thread={thread}
                        visual={statusVisual(thread)}
                        projectOptions={knownProjects}
                        whereOptions={knownWhere}
                        settingsProjects={deck.settings.projects}
                        onStatus={setStatus}
                        onPatch={patchThread}
                        onDelete={deleteThread}
                        onAddProject={(name) => upsertProjectSetting(name, { name, color: projectColor(name).color })}
                      >
                        <button className="summary-action" type="button" onClick={() => setFocus(thread.id)} title="Make focus" aria-label="Make focus">
                          <Play size={14} />
                        </button>
                      </DashboardTask>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-command">Nothing delegated right now.</div>
              )}
            </div>
            <div className={`command-cell ${brainstormThreads.length ? "" : "is-empty"}`}>
              <div className="command-label">{laneLabels.ready}</div>
              {brainstormThreads.length ? (
                <ul className="mini-thread-list">
                  {brainstormThreads.map((thread) => (
                    <li key={thread.id}>
                      <DashboardTask
                        thread={thread}
                        visual={statusVisual(thread)}
                        projectOptions={knownProjects}
                        whereOptions={knownWhere}
                        settingsProjects={deck.settings.projects}
                        onStatus={setStatus}
                        onPatch={patchThread}
                        onDelete={deleteThread}
                        onAddProject={(name) => upsertProjectSetting(name, { name, color: projectColor(name).color })}
                      >
                        <button className="summary-action" type="button" onClick={() => setFocus(thread.id)} title="Make focus" aria-label="Make focus">
                          <Play size={14} />
                        </button>
                      </DashboardTask>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-command">No parked brainstorms.</div>
              )}
            </div>
            <div className={`command-cell ${waitingThreads.length ? "" : "is-empty"}`}>
              <div className="command-label">{laneLabels.waiting}</div>
              {waitingThreads.length ? (
                <ul className="mini-thread-list">
                  {waitingThreads.map((thread) => (
                    <li key={thread.id}>
                      <DashboardTask
                        thread={thread}
                        visual={statusVisual(thread)}
                        projectOptions={knownProjects}
                        whereOptions={knownWhere}
                        settingsProjects={deck.settings.projects}
                        onStatus={setStatus}
                        onPatch={patchThread}
                        onDelete={deleteThread}
                        onAddProject={(name) => upsertProjectSetting(name, { name, color: projectColor(name).color })}
                      >
                        <button className="summary-action" type="button" onClick={() => setFocus(thread.id)} title="Make focus" aria-label="Make focus">
                          <Play size={14} />
                        </button>
                      </DashboardTask>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-command">No outside blockers.</div>
              )}
            </div>
            <div className={`command-cell ${parkedThreads.length ? "" : "is-empty"}`}>
              <div className="command-label">{laneLabels.triage}</div>
              {parkedThreads.length ? (
                <ul className="mini-thread-list">
                  {parkedThreads.map((thread) => (
                    <li key={thread.id}>
                      <DashboardTask
                        thread={thread}
                        visual={statusVisual(thread)}
                        projectOptions={knownProjects}
                        whereOptions={knownWhere}
                        settingsProjects={deck.settings.projects}
                        onStatus={setStatus}
                        onPatch={patchThread}
                        onDelete={deleteThread}
                        onAddProject={(name) => upsertProjectSetting(name, { name, color: projectColor(name).color })}
                      >
                        <button className="summary-action" type="button" onClick={() => setFocus(thread.id)} title="Make focus" aria-label="Make focus">
                          <Play size={14} />
                        </button>
                      </DashboardTask>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-command">No parked tasks.</div>
              )}
            </div>
          </section>
        </section>
      )}

      {archived.length > 0 ? (
        <section className="archive">
          <button className="archive-toggle" type="button" onClick={() => setShowArchive((s) => !s)}>
            {showArchive ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            Archive ({archived.length})
          </button>
          {showArchive ? (
            <ul className="thread-list archive-list">
              {archived.map((thread) => (
                <li className="archive-thread tone-muted" key={thread.id}>
                  <span className="proj-badge proj-badge-sm">{thread.project}</span>
                  <span className="thread-title-static">{thread.title}</span>
                  <button className="chip-btn" type="button" onClick={() => unarchive(thread.id)}>
                    Restore
                  </button>
                  <button
                    className="icon-btn small"
                    type="button"
                    onClick={() => deleteThread(thread.id)}
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default App;
