import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "./config.js";

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function runGit(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`git exited with ${code}`)));
  });
}

export function validateTaskId(taskId: string): string {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error("Invalid task ID: use 1-64 letters, numbers, underscores, or hyphens; the first character must be alphanumeric");
  }
  return taskId;
}

async function worktreeRoot(): Promise<string> {
  const root = path.join(config.runtimeRoot, "worktrees");
  await mkdir(root, { recursive: true });
  return realpath(root);
}

function assertPathWithinRoot(target: string, root: string): void {
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes worktree root: ${target}`);
  }
}

export async function taskWorkspace(taskId: string): Promise<string> {
  const validatedTaskId = validateTaskId(taskId);
  const root = await worktreeRoot();
  const workspace = path.join(root, validatedTaskId);
  assertPathWithinRoot(workspace, root);
  return workspace;
}

export async function assertInsideWorkspace(target: string, workspace: string): Promise<void> {
  const resolvedWorkspace = await realpath(workspace);
  const resolvedTarget = await realpath(target);
  const relative = path.relative(resolvedWorkspace, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes task workspace: ${target}`);
  }
}

export async function createWorktree(taskId: string, repoPath: string): Promise<string> {
  const validatedTaskId = validateTaskId(taskId);
  const resolvedRepoPath = await realpath(repoPath);
  const workspace = await taskWorkspace(validatedTaskId);

  try {
    await lstat(workspace);
    throw new Error(`Task workspace already exists: ${workspace}`);
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : null;
    if (code !== "ENOENT") throw error;
  }

  const branch = `agent/${validatedTaskId.toLowerCase()}`;
  await runGit(["worktree", "add", workspace, "-b", branch, "main"], resolvedRepoPath);
  await assertInsideWorkspace(workspace, workspace);
  return workspace;
}
