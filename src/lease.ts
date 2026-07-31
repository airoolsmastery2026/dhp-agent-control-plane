import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { validateTaskId } from "./workspace.js";

export type ExecutionLease = {
  taskId: string;
  token: string;
  acquiredAt: string;
  expiresAt: string;
};

function leasePath(taskId: string): string {
  return path.join(config.runtimeRoot, "leases", `${validateTaskId(taskId)}.json`);
}

export async function acquireExecutionLease(taskId: string, durationMs: number): Promise<ExecutionLease> {
  if (!Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > 3_600_000) {
    throw new Error("Lease duration must be between 1000 and 3600000 milliseconds");
  }

  const target = leasePath(taskId);
  await mkdir(path.dirname(target), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = Date.now();
    const lease: ExecutionLease = {
      taskId: validateTaskId(taskId),
      token: randomUUID(),
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + durationMs).toISOString(),
    };

    try {
      const handle = await open(target, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(lease, null, 2)}\n`, "utf8");
      } finally {
        await handle.close();
      }
      return lease;
    } catch (error: unknown) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "EEXIST") throw error;
      const existing = JSON.parse(await readFile(target, "utf8")) as ExecutionLease;
      if (Date.parse(existing.expiresAt) > now) throw new Error(`Task already has an active execution lease: ${taskId}`);
      await unlink(target).catch(() => undefined);
    }
  }

  throw new Error(`Unable to acquire execution lease: ${taskId}`);
}

export async function releaseExecutionLease(lease: ExecutionLease): Promise<void> {
  const target = leasePath(lease.taskId);
  try {
    const existing = JSON.parse(await readFile(target, "utf8")) as ExecutionLease;
    if (existing.token !== lease.token) throw new Error(`Execution lease ownership mismatch: ${lease.taskId}`);
    await unlink(target);
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") throw error;
  }
}
