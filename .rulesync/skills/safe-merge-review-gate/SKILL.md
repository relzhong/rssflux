---
name: safe-merge-review-gate
description: >-
  Resolve git merge or rebase conflicts with a small safety pass for risky files. Use when the user asks Codex to merge, rebase, sync a branch, resolve conflicts, update a feature worktree from main, or review conflict resolution before committing.
---

# Safe Merge Review Gate

## Goal

Resolve merge/rebase conflicts with as little process as possible while still calling out changes that can break installs, database state, runtime wiring, authorization, or deployment.

Default posture:

- Work only in the current worktree.
- Do not switch branches unless the user explicitly asks.
- Do not merge into `main`.
- Do not commit or push.
- Resolve conflicts directly when the intended merge is clear.
- Do not run index-mutating file commands such as `git add <path>`, `git rm <path>`, or `git restore --staged <path>`. Show the exact commands for the user to run instead.
- Keep the manual review list short and actionable.

## Workflow

1. Capture the current branch, merge/rebase state, source branch if known, and conflicted files.
2. Resolve straightforward conflicts directly.
3. For risky files, resolve when intent is clear; otherwise ask the user.
4. When files must be staged, unstaged, removed from the index, or accepted as deleted, print a short terminal procedure instead of running those commands.
5. Run the smallest useful validation for the touched area.
6. Stop before committing and give a concise report.

## User-Run Git Procedures

Use this section whenever the next step requires an index or working-tree git operation that Codex should not perform directly, especially:

- `git add <path>`
- `git rm <path>`
- `git restore --staged <path>`
- `git checkout --ours <path>` or `git checkout --theirs <path>`
- `git merge --continue` or `git rebase --continue`

Interactive procedure rules:

1. Keep editing files directly when the conflict resolution itself is clear.
2. Stop before index-changing commands and show a copy/pasteable command block with only the required paths.
3. Use path-specific commands, not broad commands such as `git add .`.
4. Include a quick verification command after the operation, usually `git status --short`.
5. Ask the user to run the commands and paste the result before continuing when Codex needs the updated index state.

Example:

````markdown
Please run these in your terminal, then paste the `git status --short` output:

```bash
git add apps/admin/src/services/system/admin-resources.ts
git rm packages/shared-language/src/index.test.ts
git status --short
```
````

## Risky Files

Mention these in the final report only when they were conflicted, changed by the resolution, or need the user's attention:

- dependency files: `package.json`, lockfiles, workspace config
- Prisma/database files: schema, migrations, generated client, seed scripts
- runtime wiring: main module registration, routes, menus
- auth/RBAC/policy files
- deployment/runtime config: CI/CD, Docker, Kubernetes, `.env.example`, default config

## Stop Before Doing

Stop and ask for explicit user approval before:

1. Deleting Prisma migration directories.
2. Recreating Prisma migrations.
3. Editing already-shipped migrations.
4. Running destructive database commands.
5. Removing dependencies from `package.json`.
6. Accepting a major lockfile rewrite without a clear cause.
7. Changing auth/RBAC behavior.
8. Changing production CI/CD or deployment behavior.
9. Running `git reset --hard`.
10. Force pushing.
11. Committing.

If one of these is required to proceed, leave the worktree in a readable state, explain the exact blocker, and ask for approval.

## Quick Checks

Use these as prompts, not as a checklist to paste back to the user:

- Dependencies: keep additions from both sides; regenerate lockfiles instead of hand-editing them when possible.
- Prisma/database: preserve schema changes from both sides; do not rewrite shipped migrations; run format/generate when relevant.
- Runtime wiring: make sure imports, providers, routes, menus, and permission keys from both sides still exist.
- Deployment/auth: explain any behavior change and stop before risky production changes.

## Final Report

Always end with this shape:

````markdown
### Merge Summary

- Current branch:
- Merge/rebase source:
- Conflict type:
- Files resolved:

### Needs Attention

- <risky file, unresolved uncertainty, or "None">

### Special Decisions

- <non-trivial choice, such as kept current side, kept incoming side, combined both sides, regenerated lockfile, formatted Prisma schema, regenerated Prisma client>

### Validation Run

- `<command>`: <result>

### Suggested Next Commands

```bash
git status
git diff --stat
git diff
pnpm install --frozen-lockfile
pnpm test
pnpm build
git add <resolved-file>
git rm <deleted-file>
git commit -m "merge main into <branch>"
```
````

If validation cannot run, state why and list the remaining risk in `Needs Attention`.
