import { spawn } from "node:child_process";
import { evaluateCommand } from "./policy.js";
import { writeAudit } from "./audit.js";
import { assertInsideWorkspace } from "./workspace.js";
import { assertExecutionApproved, readManifest } from "./manifest.js";

export async function runAllowedCommand(taskId: string, command: string, cwd: string, workspace: string): Promise<void> {
  await assertInsideWorkspace(cwd, workspace);
  const manifest = await readManifest(taskId);

  try {
    assertExecutionApproved(manifest, command);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    await writeAudit({ taskId, action: "approval-gate", allowed: false, detail: { command, cwd, reason } });
    throw error;
  }

  const decision = evaluateCommand(command);
  await writeAudit({ taskId, action: "shell", allowed: decision.allowed, detail: { command, cwd, reason: decision.reason } });
  if (!decision.allowed) throw new Error(decision.reason);

  const [binary, ...args] = command.trim().split(/\s+/);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { cwd, stdio: "inherit", shell: false, env: process.env });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}
