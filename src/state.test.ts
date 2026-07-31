import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { TaskStateStore } from "./state.js";

test("persists and updates task state", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dhp-state-"));
  const databasePath = path.join(root, "state.sqlite");
  const store = new TaskStateStore(databasePath);

  try {
    store.upsert("DHP-TEST-1", "created", { repositoryPath: "/repo" });
    store.upsert("DHP-TEST-1", "running", { workspacePath: "/workspace" });
    store.upsert("DHP-TEST-1", "failed", { error: "quality failed" });

    const task = store.get("DHP-TEST-1");
    assert.ok(task);
    assert.equal(task.status, "failed");
    assert.equal(task.repositoryPath, "/repo");
    assert.equal(task.workspacePath, "/workspace");
    assert.equal(task.error, "quality failed");
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("creates schema idempotently", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dhp-state-"));
  const databasePath = path.join(root, "state.sqlite");

  const first = new TaskStateStore(databasePath);
  first.close();
  const second = new TaskStateStore(databasePath);
  second.close();

  rmSync(root, { recursive: true, force: true });
});
