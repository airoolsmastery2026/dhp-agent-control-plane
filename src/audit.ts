import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

export type AuditEvent = {
  taskId: string;
  action: string;
  allowed: boolean;
  detail: Record<string, unknown>;
};

export async function writeAudit(event: AuditEvent): Promise<void> {
  await mkdir(config.auditRoot, { recursive: true });
  const record = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  const target = path.join(config.auditRoot, `${event.taskId}.jsonl`);
  await appendFile(target, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}
