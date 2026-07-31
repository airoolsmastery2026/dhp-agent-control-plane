const allowedExact = new Set([
  "git status",
  "git diff",
  "git log",
  "git grep",
  "pnpm install --frozen-lockfile",
  "pnpm lint",
  "pnpm test",
  "pnpm build",
  "pnpm typecheck"
]);

const deniedFragments = [
  "sudo",
  "rm -rf",
  "git push --force",
  "git reset --hard",
  "git clean -fd",
  "docker system prune",
  "curl | sh",
  "wget | sh",
  ".env.production"
];

export type PolicyDecision = {
  allowed: boolean;
  reason: string;
};

export function evaluateCommand(command: string): PolicyDecision {
  const normalized = command.trim().replace(/\s+/g, " ");

  const denied = deniedFragments.find((fragment) => normalized.includes(fragment));
  if (denied) {
    return { allowed: false, reason: `Denied command fragment: ${denied}` };
  }

  if (allowedExact.has(normalized)) {
    return { allowed: true, reason: "Exact allowlist match" };
  }

  if (/^pnpm run (lint|test|build|typecheck)$/.test(normalized)) {
    return { allowed: true, reason: "Allowed quality script" };
  }

  return { allowed: false, reason: "Command is not present in the allowlist" };
}
