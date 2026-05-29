import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bot, Check, GripVertical, ParkingCircle, Trash2 } from "lucide-react";
import type { ColumnDefinition, Task } from "../types";

type ThreadCardProps = {
  task: Task;
  columns: ColumnDefinition[];
  onMoveTask: (taskId: string, status: Task["status"]) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
};

export function ThreadCard({
  task,
  columns,
  onMoveTask,
  onUpdateTask,
  onDeleteTask,
}: ThreadCardProps) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      className={`task-card task-card-${task.status} ${isDragging ? "task-card-dragging" : ""}`}
      ref={setNodeRef}
      style={style}
      data-task-id={task.id}
    >
      <div className="card-topline">
        <button
          className="drag-button"
          type="button"
          ref={setActivatorNodeRef}
          aria-label="Drag task"
          title="Drag task"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" size={16} />
        </button>
        <select
          value={task.status}
          onChange={(event) => onMoveTask(task.id, event.target.value as Task["status"])}
          aria-label="Status"
        >
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>
      </div>

      <textarea
        className="task-title"
        value={task.title}
        onChange={(event) => onUpdateTask(task.id, { title: event.target.value })}
        aria-label="Task title"
        rows={3}
      />

      <textarea
        className="task-note"
        value={task.note}
        onChange={(event) => onUpdateTask(task.id, { note: event.target.value })}
        placeholder="Why open / next action"
        aria-label="Task note"
        rows={2}
      />

      <div className="card-actions">
        <button type="button" onClick={() => onMoveTask(task.id, "waiting")} aria-label="Move to agents or waiting" title="Agents / Waiting">
          <Bot size={15} />
        </button>
        <button type="button" onClick={() => onMoveTask(task.id, "parked")} aria-label="Park task" title="Park">
          <ParkingCircle size={15} />
        </button>
        <button type="button" onClick={() => onMoveTask(task.id, "done")} aria-label="Mark done" title="Done">
          <Check size={15} />
        </button>
        <button type="button" onClick={() => onDeleteTask(task.id)} aria-label="Delete task" title="Delete">
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
