import assert from "node:assert/strict";
import test from "node:test";
import { acquireExecutionLease, releaseExecutionLease } from "./lease.js";

function taskId(suffix: string): string {
  return `DHP-LEASE-${process.pid}-${suffix}`;
}

test("prevents concurrent execution for the same task", async () => {
  const lease = await acquireExecutionLease(taskId("DUPLICATE"), 5_000);
  try {
    await assert.rejects(() => acquireExecutionLease(lease.taskId, 5_000), /active execution lease/);
  } finally {
    await releaseExecutionLease(lease);
  }
});

test("requires the owner token when releasing a lease", async () => {
  const lease = await acquireExecutionLease(taskId("OWNER"), 5_000);
  await assert.rejects(
    () => releaseExecutionLease({ ...lease, token: "not-the-owner" }),
    /ownership mismatch/,
  );
  await releaseExecutionLease(lease);
});

test("reclaims an expired execution lease", async () => {
  const first = await acquireExecutionLease(taskId("EXPIRED"), 1_000);
  await new Promise((resolve) => setTimeout(resolve, 1_050));
  const replacement = await acquireExecutionLease(first.taskId, 5_000);
  assert.notEqual(replacement.token, first.token);
  await releaseExecutionLease(replacement);
});

test("rejects unsafe lease durations", async () => {
  await assert.rejects(() => acquireExecutionLease(taskId("SHORT"), 999), /between 1000 and 3600000/);
  await assert.rejects(() => acquireExecutionLease(taskId("LONG"), 3_600_001), /between 1000 and 3600000/);
});
