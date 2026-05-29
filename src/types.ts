export type ColumnId = "todo" | "now" | "waiting" | "needs_me" | "parked" | "done";

export type Task = {
  id: string;
  title: string;
  note: string;
  status: ColumnId;
  createdAt: string;
  updatedAt: string;
};

export type SessionState = {
  mission: string;
  capture: string;
  tasks: Task[];
};

export type ColumnDefinition = {
  id: ColumnId;
  title: string;
  empty: string;
};
