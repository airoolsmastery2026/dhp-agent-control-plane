import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCommand } from "./policy.js";

test("allows exact safe commands", () => {
  assert.equal(evaluateCommand("git status").allowed, true);
  assert.equal(evaluateCommand("pnpm run build").allowed, true);
});

test("denies destructive commands", () => {
  const decision = evaluateCommand("rm -rf runtime");
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /Denied command fragment/);
});

test("denies production environment access", () => {
  assert.equal(evaluateCommand("cat .env.production").allowed, false);
});

test("denies unknown commands by default", () => {
  const decision = evaluateCommand("node arbitrary-script.js");
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /not present in the allowlist/);
});
