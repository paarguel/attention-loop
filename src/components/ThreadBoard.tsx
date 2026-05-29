import { closestCorners, DndContext, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import type { ColumnDefinition, ColumnId, Task } from "../types";
import { ThreadCard } from "./ThreadCard";

type ThreadBoardProps = {
  columns: ColumnDefinition[];
  tasksByColumn: Record<ColumnId, Task[]>;
  onMoveTask: (taskId: string, status: ColumnId, targetIndex?: number) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
};

type DroppableColumnProps = {
  column: ColumnDefinition;
  tasks: Task[];
  children: ReactNode;
};

function DroppableColumn({ column, tasks, children }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    data: { type: "column", status: column.id },
  });

  return (
    <div className={`column ${isOver ? "column-over" : ""}`} ref={setNodeRef} data-column-id={column.id}>
      <header className="column-header">
        <h3>{column.title}</h3>
        <span>{tasks.length}</span>
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="column-list">
          {tasks.length === 0 ? <p className="empty-column">{column.empty}</p> : null}
          {children}
        </div>
      </SortableContext>
    </div>
  );
}

export function ThreadBoard({
  columns,
  tasksByColumn,
  onMoveTask,
  onUpdateTask,
  onDeleteTask,
}: ThreadBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const taskId = String(active.id);
    const overId = String(over.id);

    if (taskId === overId) {
      return;
    }

    const allTasks = Object.values(tasksByColumn).flat();
    const targetTask = allTasks.find((task) => task.id === overId);

    if (targetTask) {
      const targetColumnTasks = tasksByColumn[targetTask.status].filter((task) => task.id !== taskId);
      const targetIndex = targetColumnTasks.findIndex((task) => task.id === targetTask.id);
      onMoveTask(taskId, targetTask.status, targetIndex);
      return;
    }

    if (columns.some((column) => column.id === overId)) {
      onMoveTask(taskId, overId as ColumnId);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <section className="board" aria-label="Session board">
        {columns.map((column) => {
          const tasks = tasksByColumn[column.id];

          return (
            <DroppableColumn column={column} tasks={tasks} key={column.id}>
              {tasks.map((task) => (
                <ThreadCard
                  key={task.id}
                  task={task}
                  columns={columns}
                  onMoveTask={onMoveTask}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                />
              ))}
            </DroppableColumn>
          );
        })}
      </section>
    </DndContext>
  );
}
