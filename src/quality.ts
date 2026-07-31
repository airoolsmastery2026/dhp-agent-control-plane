import { readFile } from "node:fs/promises";
import path from "node:path";
import { runAllowedCommand } from "./runner.js";

const gateOrder = ["lint", "typecheck", "test", "build"] as const;

type PackageJson = {
  scripts?: Record<string, string>;
};

export async function runQualityGate(taskId: string, workspace: string): Promise<void> {
  const raw = await readFile(path.join(workspace, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as PackageJson;
  const scripts = pkg.scripts ?? {};

  for (const gate of gateOrder) {
    if (!scripts[gate]) {
      throw new Error(`Required quality script is missing: ${gate}`);
    }
    await runAllowedCommand(taskId, `pnpm run ${gate}`, workspace, workspace);
  }
}
