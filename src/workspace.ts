import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "./config.js";

function runGit(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`git exited with ${code}`)));
  });
}

export async function taskWorkspace(taskId: string): Promise<string> {
  const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const root = path.join(config.runtimeRoot, "worktrees");
  await mkdir(root, { recursive: true });
  return path.join(root, safeTaskId);
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
  const workspace = await taskWorkspace(taskId);
  const branch = `agent/${taskId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  await runGit(["worktree", "add", workspace, "-b", branch, "main"], repoPath);
  return workspace;
}
