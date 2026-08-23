---
name: review-loop
description: >-
  Runs a fast, risk-focused implementation/review/fix workflow with one writer, one reviewer by default, focused tests, and at most one narrow re-review. Use when the user asks to implement then review, review until clean, run a review/fix loop, or validate a substantial current diff.

targets:
  - pi
  - claudecode
  - codexcli
  - opencode
---

# Review Loop

## Purpose

Run a cost-aware workflow controlled by the parent AI agent:

```text
optional scout → one implementation worker → one risk-focused reviewer → one fix pass → optional narrow re-review → final validation
```

Optimize for short implementation tasks without weakening material safety checks. Keep one writer in the active worktree. Children must not manage the loop or launch agents unless explicitly assigned a bounded fanout role. Ask the user only about genuine product, scope, or architecture decisions.

## 1. Scout Only When Necessary

Skip reconnaissance when the issue, acceptance criteria, relevant files, and implementation path are already clear.

Use one read-only scout only when important context is missing, such as unclear ownership, an unfamiliar subsystem, uncertain reproduction steps, or unknown dependencies. The scout returns only implementation-relevant files, constraints, risks, and focused test commands.

For queued dependency-safe issues, the parent may parallelize read-only reconnaissance while the current writer works. Never parallelize writers in the same worktree, and do not scout work whose dependencies may still change its scope.

## 2. Implement Once

Launch one worker to implement only the approved issue scope and run focused validation. If the current diff is already the target, skip implementation and begin review.

The worker reports changed files, focused commands and exit codes, remaining risks, and anything left undone. Treat its result as review input, not automatic completion.

## 3. Review Once by Default

Launch one fresh-context, read-only reviewer after implementation. Choose the single highest-value risk specialty from [Parallel Review](../parallel-review/SKILL.md), based on the acceptance criteria and actual diff. The reviewer must inspect repository instructions and evidence directly, stay within the assigned risk, and report concise findings with severity, file/line evidence, demonstrated impact, and the smallest safe fix.

Do not use three reviewers by default. Add another reviewer only when the user explicitly requests parallel/adversarial review or the change demonstrably spans another independent, material risk that one focused review cannot responsibly cover.

The reviewer runs only missing focused tests. It must not repeat a full suite already run elsewhere.

## 4. Synthesize Strictly

The parent accepts findings only when they are evidence-backed and relevant to the approved work. Reject findings that are:

- outside the issue acceptance criteria
- pure hardening without a demonstrated failure or credible acceptance-criteria violation
- based only on environmental checks already documented as unrun or unavailable
- duplicate, speculative, stylistic, or optional cleanup unrelated to correctness

Do not mistake scope control for reduced safety. Treat demonstrated authorization gaps, missing persistence, unsafe redispatch or retries, generation/concurrency races, data-loss paths, and financial-integrity failures as fixes-now when relevant to the change.

Pause for the user only when a finding requires a new product, scope, or architecture decision.

## 5. Fix Once

If accepted findings exist, use one worker to apply only those fixes and run the narrowest relevant validation. Prefer the original implementation worker when continuity helps. Do not launch multiple fix writers in the same worktree.

## 6. Re-review Once, Narrowly

Run at most one targeted re-review, and only when the fix touched material high-risk behavior such as authorization, money, persistence, migrations, concurrency, retry/dispatch safety, privacy, or public contracts.

The re-review examines only the accepted finding, changed fix, and focused evidence. Skip it for wording, formatting, mechanical corrections, test-only expectation changes, or low-risk fixes already covered by focused validation.

If re-review reveals a new blocker or an incorrect fix, stop and report it unless the user explicitly approves another iteration.

## 7. Validate Once at the End

During implementation and review, use focused tests only. Run shared expensive or full suites at most once, at the final pre-commit gate, and only when the repository workflow, changed scope, or user requires them. Do not have reviewers repeat them.

Before finishing, inspect the final diff and summarize:

- whether a scout was used and why
- implementation scope
- reviewer specialty and accepted/rejected findings
- fixes and any narrow re-review
- focused validation plus the one final full-suite result, if required
- residual risks, unrun environmental checks, and stop reason
