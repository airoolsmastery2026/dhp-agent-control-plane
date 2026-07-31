# DHP Agent Control Plane

Local-first, policy-controlled coding agent runtime for Đại Hải Phát.

## DHP-AGENT-001 scope

This MVP provides:

- TypeScript control plane CLI
- deny-by-default shell policy
- filesystem workspace boundary
- JSONL audit log
- Git worktree creation for isolated tasks
- quality gate discovery and execution from the target repository's `package.json`
- Ollama service definition through Docker Compose

Explicitly excluded from this phase:

- multi-agent orchestration
- dashboard
- Telegram control
- automatic push or pull request creation
- merge permissions
- production deployment
- production secret access

## Safety model

The source repository is used for Git metadata and analysis. All writes must occur in a task-specific worktree under the configured runtime root. Every allowed or denied command is recorded in the audit log.

## Local usage

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
node dist/cli.js init-task --task DHP-001 --repo /absolute/path/to/dai-hai-phat-web
node dist/cli.js quality --task DHP-001
```

Copy `.env.example` to `.env` and adjust local paths before running. The MVP does not read production environment files.
