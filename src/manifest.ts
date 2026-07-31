import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "./config.js";
import { validateTaskId } from "./workspace.js";

export const approvalSchema = z.enum(["pending", "approved", "rejected"]);
export const taskManifestSchema = z.object({
  taskId: z.string().transform(validateTaskId),
  repositoryPath: z.string().min(1),
  workspacePath: z.string().min(1),
  objective: z.string().min(1).max(2000),
  allowedCommands: z.array(z.string().min(1)).min(1),
  maxExecutionMs: z.number().int().min(1_000).max(3_600_000).default(900_000),
  approval: approvalSchema.default("pending"),
  approvedBy: z.string().min(1).nullable().default(null),
  updatedAt: z.string().datetime(),
});

export type TaskManifest = z.infer<typeof taskManifestSchema>;

function manifestPath(taskId: string): string {
  return path.join(config.runtimeRoot, "tasks", `${validateTaskId(taskId)}.json`);
}

export async function writeManifest(manifest: TaskManifest): Promise<void> {
  const parsed = taskManifestSchema.parse(manifest);
  const target = manifestPath(parsed.taskId);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}

export async function readManifest(taskId: string): Promise<TaskManifest> {
  const raw = await readFile(manifestPath(taskId), "utf8");
  return taskManifestSchema.parse(JSON.parse(raw));
}

export async function setApproval(taskId: string, approval: "approved" | "rejected", approvedBy: string): Promise<TaskManifest> {
  const manifest = await readManifest(taskId);
  const updated = { ...manifest, approval, approvedBy, updatedAt: new Date().toISOString() };
  await writeManifest(updated);
  return updated;
}

export function assertExecutionApproved(manifest: TaskManifest, command: string): void {
  if (manifest.approval !== "approved") throw new Error(`Task approval is ${manifest.approval}`);
  if (!manifest.allowedCommands.includes(command)) throw new Error(`Command is outside approved task scope: ${command}`);
}
