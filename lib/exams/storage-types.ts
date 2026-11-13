export interface AttemptSession {
  id: string;
  startedAt: number;
  status: "running" | "finished";
  completedAt?: number;
}
export interface SavedAttempt<T> {
  session: T;
  revision: number;
  updatedAt: number;
}
