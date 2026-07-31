#!/usr/bin/env node
import path from "node:path";
import { createWorktree, taskWorkspace } from "./workspace.js";
import { runQualityGate } from "./quality.js";
import { writeAudit } from "./audit.js";

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing argument: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const taskId = arg("--task");

  if (command === "init-task") {
    const repoPath = path.resolve(arg("--repo"));
    const workspace = await createWorktree(taskId, repoPath);
    await writeAudit({ taskId, action: "workspace-created", allowed: true, detail: { repoPath, workspace } });
    console.log(workspace);
    return;
  }

  if (command === "quality") {
    const workspace = await taskWorkspace(taskId);
    await runQualityGate(taskId, workspace);
    await writeAudit({ taskId, action: "quality-gate", allowed: true, detail: { workspace } });
    return;
  }

  throw new Error(`Unsupported command: ${command ?? "<none>"}`);
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
