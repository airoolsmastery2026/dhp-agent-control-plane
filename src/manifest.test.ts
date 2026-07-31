import assert from "node:assert/strict";
import test from "node:test";
import { assertExecutionApproved, taskManifestSchema } from "./manifest.js";

const base = {
  taskId: "DHP-AGENT-004",
  repositoryPath: "/repo",
  workspacePath: "/runtime/worktrees/DHP-AGENT-004",
  objective: "Validate approval gate",
  allowedCommands: ["pnpm test", "pnpm build"],
  approvedBy: null,
  updatedAt: new Date().toISOString(),
};

test("parses a valid pending manifest", () => {
  const manifest = taskManifestSchema.parse({ ...base, approval: "pending" });
  assert.equal(manifest.approval, "pending");
});

test("blocks pending and rejected tasks", () => {
  assert.throws(() => assertExecutionApproved(taskManifestSchema.parse({ ...base, approval: "pending" }), "pnpm test"), /pending/);
  assert.throws(() => assertExecutionApproved(taskManifestSchema.parse({ ...base, approval: "rejected" }), "pnpm test"), /rejected/);
});

test("approved task can only run declared commands", () => {
  const manifest = taskManifestSchema.parse({ ...base, approval: "approved", approvedBy: "human-reviewer" });
  assert.doesNotThrow(() => assertExecutionApproved(manifest, "pnpm test"));
  assert.throws(() => assertExecutionApproved(manifest, "pnpm publish"), /outside approved task scope/);
});

test("rejects invalid task identifiers and empty command scope", () => {
  assert.throws(() => taskManifestSchema.parse({ ...base, taskId: "../escape", approval: "pending" }));
  assert.throws(() => taskManifestSchema.parse({ ...base, allowedCommands: [], approval: "pending" }));
});
