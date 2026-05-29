import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Plus, RotateCcw, Trash2 } from "lucide-react";
import { clearSession, emptySession, loadSession, saveSession } from "./storage";
import type { ColumnDefinition, ColumnId, SessionState, Task } from "./types";
import { MissionPanel } from "./components/MissionPanel";
import { ThreadBoard } from "./components/ThreadBoard";
import { ResetPrompt } from "./components/ResetPrompt";

const columns: ColumnDefinition[] = [
  { id: "todo", title: "To Do", empty: "Nothing queued." },
  { id: "now", title: "Now", empty: "Pick one thread." },
  { id: "waiting", title: "Agents / Waiting", empty: "No delegated loops." },
  { id: "needs_me", title: "Needs Me", empty: "No decisions waiting." },
  { id: "parked", title: "Parked", empty: "Nothing parked." },
  { id: "done", title: "Done", empty: "No closed loops yet." },
];

function makeTask(title: string, status: ColumnId = "todo"): Task {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title,
    note: "",
    status,
    createdAt: now,
    updatedAt: now,
  };
}

function App() {
  const [session, setSession] = useState<SessionState>(() => loadSession());

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const tasksByColumn = useMemo(() => {
    return columns.reduce<Record<ColumnId, Task[]>>(
      (grouped, column) => {
        grouped[column.id] = session.tasks.filter((task) => task.status === column.id);
        return grouped;
      },
      {
        todo: [],
        now: [],
        waiting: [],
        needs_me: [],
        parked: [],
        done: [],
      },
    );
  }, [session.tasks]);

  const openCount = session.tasks.filter((task) => task.status !== "done").length;
  const nowTask = tasksByColumn.now[0];

  function patchSession(patch: Partial<SessionState>) {
    setSession((current) => ({ ...current, ...patch }));
  }

  function addCaptureTasks() {
    const titles = session.capture
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (titles.length === 0) {
      return;
    }

    setSession((current) => ({
      ...current,
      capture: "",
      tasks: [...current.tasks, ...titles.map((title) => makeTask(title))],
    }));
  }

  function addBlankTask() {
    setSession((current) => ({
      ...current,
      tasks: [...current.tasks, makeTask("Untitled task")],
    }));
  }

  function updateTask(taskId: string, patch: Partial<Task>) {
    setSession((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task,
      ),
    }));
  }

  function deleteTask(taskId: string) {
    setSession((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  }

  function moveTask(taskId: string, targetStatus: ColumnId, targetIndex?: number) {
    setSession((current) => {
      const movingTask = current.tasks.find((task) => task.id === taskId);

      if (!movingTask) {
        return current;
      }

      const updatedTask = {
        ...movingTask,
        status: targetStatus,
        updatedAt: new Date().toISOString(),
      };
      const remaining = current.tasks
        .filter((task) => task.id !== taskId)
        .map((task) =>
          targetStatus === "now" && task.status === "now"
            ? { ...task, status: "todo" as const, updatedAt: new Date().toISOString() }
            : task,
        );
      const targetColumn = remaining.filter((task) => task.status === targetStatus);
      const normalizedIndex =
        typeof targetIndex === "number" ? Math.max(0, Math.min(targetIndex, targetColumn.length)) : targetColumn.length;
      const insertBeforeId = targetColumn[normalizedIndex]?.id;
      const nextTasks = [...remaining];

      if (insertBeforeId) {
        const insertAt = nextTasks.findIndex((task) => task.id === insertBeforeId);
        nextTasks.splice(insertAt, 0, updatedTask);
      } else {
        const lastInColumn = [...nextTasks].reverse().find((task) => task.status === targetStatus);

        if (lastInColumn) {
          const insertAt = nextTasks.findIndex((task) => task.id === lastInColumn.id) + 1;
          nextTasks.splice(insertAt, 0, updatedTask);
        } else {
          nextTasks.push(updatedTask);
        }
      }

      return {
        ...current,
        tasks: nextTasks,
      };
    });
  }

  function resetSession() {
    const confirmed = window.confirm("Clear this session?");

    if (!confirmed) {
      return;
    }

    clearSession();
    setSession(emptySession);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Session Deck</p>
          <h1>Current Work Session</h1>
        </div>
        <div className="topbar-actions">
          <span className="session-stat">
            <ClipboardList aria-hidden="true" size={16} />
            {openCount} open
          </span>
          <button className="icon-button" type="button" onClick={resetSession} aria-label="Clear session" title="Clear session">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <MissionPanel
        mission={session.mission}
        capture={session.capture}
        nowTitle={nowTask?.title}
        onMissionChange={(mission) => patchSession({ mission })}
        onCaptureChange={(capture) => patchSession({ capture })}
        onAddCaptureTasks={addCaptureTasks}
      />

      <div className="board-toolbar">
        <div>
          <p className="section-kicker">Board</p>
          <h2>Session Board</h2>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={addBlankTask}>
            <Plus size={16} />
            Add
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => session.tasks.forEach((task) => updateTask(task.id, { status: "done" }))}
            disabled={session.tasks.length === 0}
          >
            <CheckCircle2 size={16} />
            Finish
          </button>
        </div>
      </div>

      <ThreadBoard
        columns={columns}
        tasksByColumn={tasksByColumn}
        onMoveTask={moveTask}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
      />

      <ResetPrompt />

      {session.tasks.length > 0 ? (
        <button className="danger-button" type="button" onClick={() => setSession((current) => ({ ...current, tasks: [] }))}>
          <Trash2 size={16} />
          Clear cards
        </button>
      ) : null}
    </main>
  );
}

export default App;
