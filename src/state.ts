import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

export type TaskStatus = "created" | "running" | "succeeded" | "failed";

export type TaskRecord = {
  taskId: string;
  status: TaskStatus;
  repositoryPath: string | null;
  workspacePath: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskRow = {
  task_id: string;
  status: TaskStatus;
  repository_path: string | null;
  workspace_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export class TaskStateStore {
  private readonly database: DatabaseSync;

  constructor(databasePath = config.stateDbPath) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('created', 'running', 'succeeded', 'failed')),
        repository_path TEXT,
        workspace_path TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  upsert(taskId: string, status: TaskStatus, detail: {
    repositoryPath?: string;
    workspacePath?: string;
    error?: string | null;
  } = {}): void {
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO tasks (task_id, status, repository_path, workspace_path, error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        status = excluded.status,
        repository_path = COALESCE(excluded.repository_path, tasks.repository_path),
        workspace_path = COALESCE(excluded.workspace_path, tasks.workspace_path),
        error = excluded.error,
        updated_at = excluded.updated_at
    `).run(
      taskId,
      status,
      detail.repositoryPath ?? null,
      detail.workspacePath ?? null,
      detail.error ?? null,
      now,
      now,
    );
  }

  recoverInterrupted(taskId: string): boolean {
    const now = new Date().toISOString();
    const result = this.database.prepare(`
      UPDATE tasks
      SET status = 'failed', error = 'Task interrupted before completion', updated_at = ?
      WHERE task_id = ? AND status = 'running'
    `).run(now, taskId);
    return result.changes === 1;
  }

  get(taskId: string): TaskRecord | null {
    const row = this.database.prepare("SELECT * FROM tasks WHERE task_id = ?").get(taskId) as TaskRow | undefined;
    if (!row) return null;
    return {
      taskId: row.task_id,
      status: row.status,
      repositoryPath: row.repository_path,
      workspacePath: row.workspace_path,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  close(): void {
    this.database.close();
  }
}
