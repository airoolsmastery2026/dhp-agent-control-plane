import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { assertInsideWorkspace, validateTaskId } from "./workspace.js";

test("accepts canonical task IDs", () => {
  assert.equal(validateTaskId("DHP-AGENT-003"), "DHP-AGENT-003");
  assert.equal(validateTaskId("task_1"), "task_1");
});

test("rejects path traversal and ambiguous task IDs", () => {
  for (const taskId of ["", "../escape", "/absolute", ".hidden", "task id", "a".repeat(65)]) {
    assert.throws(() => validateTaskId(taskId), /Invalid task ID/);
  }
});

test("allows real paths inside workspace", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "dhp-workspace-"));
  const workspace = path.join(root, "workspace");
  const nested = path.join(workspace, "src");
  mkdirSync(nested, { recursive: true });

  try {
    await assertInsideWorkspace(nested, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("blocks symlink escape from workspace", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "dhp-workspace-"));
  const workspace = path.join(root, "workspace");
  const outside = path.join(root, "outside");
  mkdirSync(workspace, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(outside, "secret.txt"), "not accessible");
  const link = path.join(workspace, "escape");
  symlinkSync(outside, link, "dir");

  try {
    await assert.rejects(assertInsideWorkspace(link, workspace), /Path escapes task workspace/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
