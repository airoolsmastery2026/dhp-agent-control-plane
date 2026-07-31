#!/usr/bin/env node
import path from "node:path";
import { createWorktree, taskWorkspace, validateTaskId } from "./workspace.js";
import { runQualityGate } from "./quality.js";
import { writeAudit } from "./audit.js";
import { TaskStateStore } from "./state.js";
import { setApproval, writeManifest } from "./manifest.js";

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing argument: ${name}`);
  return value;
}

function optionalArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const taskId = validateTaskId(arg("--task"));
  const state = new TaskStateStore();

  try {
    if (command === "init-task") {
      const repoPath = path.resolve(arg("--repo"));
      const objective = arg("--objective");
      const allowedCommands = arg("--commands").split(",").map((value) => value.trim()).filter(Boolean);
      const maxExecutionMs = Number(optionalArg("--timeout-ms") ?? "900000");
      state.upsert(taskId, "created", { repositoryPath: repoPath });
      const workspace = await createWorktree(taskId, repoPath);
      await writeManifest({ taskId, repositoryPath: repoPath, workspacePath: workspace, objective, allowedCommands, maxExecutionMs, approval: "pending", approvedBy: null, updatedAt: new Date().toISOString() });
      state.upsert(taskId, "succeeded", { repositoryPath: repoPath, workspacePath: workspace });
      await writeAudit({ taskId, action: "workspace-created", allowed: true, detail: { repoPath, workspace, approval: "pending", maxExecutionMs } });
      console.log(workspace);
      return;
    }

    if (command === "approve" || command === "reject") {
      const approval = command === "approve" ? "approved" : "rejected";
      const actor = arg("--by");
      await setApproval(taskId, approval, actor);
      await writeAudit({ taskId, action: "task-approval", allowed: approval === "approved", detail: { approval, actor } });
      console.log(`${taskId}: ${approval}`);
      return;
    }

    if (command === "quality") {
      const workspace = await taskWorkspace(taskId);
      state.upsert(taskId, "running", { workspacePath: workspace });
      try {
        await runQualityGate(taskId, workspace);
        state.upsert(taskId, "succeeded", { workspacePath: workspace });
        await writeAudit({ taskId, action: "quality-gate", allowed: true, detail: { workspace } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        state.upsert(taskId, "failed", { workspacePath: workspace, error: message });
        await writeAudit({ taskId, action: "quality-gate", allowed: false, detail: { workspace, error: message } });
        throw error;
      }
      return;
    }

    if (command === "recover") {
      const recovered = state.recoverInterrupted(taskId);
      await writeAudit({ taskId, action: "task-recovery", allowed: recovered, detail: { recovered, reason: recovered ? "interrupted" : "task-not-running" } });
      if (!recovered) throw new Error(`Task is not in running state: ${taskId}`);
      console.log(`Recovered interrupted task: ${taskId}`);
      return;
    }

    throw new Error(`Unsupported command: ${command ?? "<none>"}`);
  } finally {
    state.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
