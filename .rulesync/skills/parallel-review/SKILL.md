---
name: parallel-review
description: >-
  Runs a fresh-context, multi-reviewer adversarial review with dynamically selected, non-overlapping reviewer specialties and parent synthesis. Use when the user asks for a parallel review, three-reviewer review, adversarial review, or independent review perspectives on a diff, plan, or implementation.

targets:
  - pi
  - claudecode
  - codexcli
  - opencode
---

# Parallel Review

## Purpose

Provide the shared reviewer-selection method for parallel reviews and review loops. The parent means the main AI agent, not the human user. The parent autonomously selects and assigns reviewer specialties, remains the final workflow decision-maker, and asks the user only about genuine product, scope, or architecture decisions. Reviewers inspect the target independently, report evidence-backed findings, and do not edit project files unless explicitly assigned a writer pass.

For a direct parallel-review request, launch three reviewers by default. A workflow that reuses this skill, such as `review-loop`, may select only the smallest valuable subset and must not inherit the default count blindly.

## Scope First

Treat any URL, issue, file, plan, or freeform focus in the request as the primary scope. Read or fetch it before choosing reviewers. Inspect the current diff and applicable repository instructions, then pass the target and angle explicitly to every reviewer.

## Reviewer Selection

Selection is automatic. Do not ask the user to choose reviewer count or specialties unless they explicitly want that control. Before launching reviewers, the parent inspects the request, changed files, diff, tests, and applicable instructions; maps the change to independent failure domains; ranks them by impact and uncertainty; chooses the required count; and assigns one explicit specialty to each reviewer.

Select specialties from independent failure modes in the actual change, not from a fixed generic list. Prefer risks involving security, privacy, authorization, money, persisted data, concurrency, migrations, and public contracts over generic style concerns. Break ties by choosing the least-overlapping specialty that could reveal a materially different failure. Never ask reviewers to choose their own specialties.

Use these reviewer specialties as a menu:

- **Correctness and regressions:** requirements, behavior, edge cases, error paths.
- **Security and privacy:** authorization, trust boundaries, unsafe input/output, secrets, personal data, redaction.
- **Persistence and concurrency:** schemas, migrations, transactions, queues, races, retries, shutdown, failure isolation.
- **Contracts and integration:** API/events/configuration, shared types, external systems, cross-client compatibility.
- **Tests and validation:** test layer, meaningful assertions, missing cases, adequacy of verification evidence.
- **UX and accessibility:** user flows, state feedback, copy, keyboard/screen-reader behavior, visual consistency.
- **Types and boundaries:** source-of-truth types, casts, module ownership, error boundaries, testability.
- **Simplicity and maintainability:** unnecessary complexity, duplication, brittle abstractions, naming, cleanup worth doing now.
- **Documentation accuracy:** implementation fidelity, completeness, reader flow, operational safety, non-robotic prose.

For direct invocation, choose the three highest-value non-overlapping specialties unless the user requests another count or names the angles. If fewer user-specified angles are provided than requested reviewers, fill only with genuinely independent missing specialties.

For reuse by another workflow, return to the workflow's risk-based count. One reviewer is enough when one specialty dominates; two cover two independent risks; three are reserved for broad or high-risk changes spanning at least three domains.

## Reviewer Prompt Contract

Use fresh context unless the user explicitly requests inherited context. Ask each reviewer to:

- inspect repository instructions, the named scope, and current diff directly
- stay within its assigned specialty
- return concise findings with severity, file/line evidence, impact, and smallest safe fix
- distinguish blockers and fixes-now from optional observations
- avoid edits and avoid broad context summaries
- inspect existing validation evidence and run only missing focused checks

Do not have every reviewer run the same full test suite. Run shared expensive validation once through the parent or writer where practical.

## Execution and Failure Handling

Run selected reviewers in parallel. While they work, the parent may perform a narrow independent inspection.

If a reviewer fails after returning usable findings, keep the findings. Retry only when the failed reviewer covered a critical risk with no surviving evidence; retry that specialty alone rather than restarting the full group.

## Parent Synthesis

Merge duplicate findings and classify the result into:

- blockers or decisions requiring the user
- fixes worth doing now
- optional improvements
- unsupported, duplicate, or deferred feedback, with a short reason

Do not apply every suggestion blindly.

## Autofix Mode

If the user includes the exact word `autofix`, treat it as workflow control rather than review scope. After synthesis, use one writer to apply only fixes worth doing now, validate once, and summarize. Do not apply optional improvements unless explicitly requested.

Without autofix, ask before editing unless implementation or addressing review feedback was already authorized. Offer a compact choice between fixes-now only and fixes plus optional improvements when both exist.
