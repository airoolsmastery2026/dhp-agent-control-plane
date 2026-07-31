import { spawn } from "node:child_process";
import { evaluateCommand } from "./policy.js";
import { writeAudit } from "./audit.js";
import { assertInsideWorkspace } from "./workspace.js";
import { assertExecutionApproved, readManifest } from "./manifest.js";
import { acquireExecutionLease, releaseExecutionLease } from "./lease.js";

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

  const lease = await acquireExecutionLease(taskId, manifest.maxExecutionMs);
  await writeAudit({ taskId, action: "execution-lease", allowed: true, detail: { token: lease.token, expiresAt: lease.expiresAt } });

  try {
    const [binary, ...args] = command.trim().split(/\s+/);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(binary, args, { cwd, stdio: "inherit", shell: false, env: process.env });
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Command timed out after ${manifest.maxExecutionMs}ms: ${command}`));
      }, manifest.maxExecutionMs);
      timer.unref();

      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with ${code ?? signal}`));
      });
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    await writeAudit({ taskId, action: "command-execution", allowed: false, detail: { command, reason } });
    throw error;
  } finally {
    await releaseExecutionLease(lease);
    await writeAudit({ taskId, action: "execution-lease-release", allowed: true, detail: { token: lease.token } });
  }
}
