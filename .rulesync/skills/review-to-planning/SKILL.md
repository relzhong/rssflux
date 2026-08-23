---
name: review-to-planning
description: >-
  Convert an architecture review finding, refactoring candidate, module-depth
  critique, or technical review report into an implementation-aware planning
  document under `docs/planning/`. Use when the user wants to preserve
  architectural intent from `docs/review/`, HTML reports, review notes, or
  diagnostic findings before turning the work into issues, ADRs, or code.
---

# Review To Planning

## Purpose

Turn an architecture or code-health review item into a planning document that
preserves the technical intent. Unlike `sketch-to-planning`, keep the module
boundary, leakage, testability, consistency, and trade-off signals that make the
review finding valuable.

Use this as the bridge from `docs/review/` to `docs/planning/` before PRDs,
issues, ADRs, or implementation.

## Workflow

1. Read the source review item and its local context. For HTML reports, inspect
   the selected anchor plus nearby "problem", "solution", diagram labels,
   candidate files, and recommendation text.
2. If the finding points at domain docs, ADRs, concept docs, or code paths, read
   only the minimum context needed to preserve the review intent.
3. Derive a short planning title from the review item.
4. Convert the title to lowercase kebab-case and write
   `docs/planning/<review-title>.md`.
5. If a file with that name already exists, append `-2`, `-3`, etc. rather than
   overwriting unless the user explicitly asks to update it.
6. Keep the plan implementation-aware, but avoid prematurely choosing detailed
   schemas, migrations, RPC fields, or exact class/function names unless the
   review finding already depends on them.

## Filename Rules

- Use the review finding's actual content, not a generic name.
- Prefer 3-7 words.
- Use lowercase ASCII letters, digits, and hyphens only.
- Keep architectural verbs when they matter, such as `deepen`, `extract`,
  `consolidate`, `isolate`, `centralize`, or `split`.
- Examples:
  - "Deepen Agent assignment" -> `docs/planning/deepen-agent-assignment.md`
  - "Deepen Chat realtime" -> `docs/planning/deepen-chat-realtime.md`
  - "Consolidate list query execution" -> `docs/planning/list-query-execution.md`

## Output Shape

Use this structure:

```markdown
# Refactor Planning: <review finding name>

## Source Review

- Review: <relative link to report or note>
- Anchor: <anchor, heading, or section name when available>
- Candidate files:
  - <file or module from review>

## Review Intent

<1-3 sentences preserving the original architecture concern and desired
direction. Name the problem as a design/architecture issue, not only as a user
behavior gap.>

## Current Shape

- <current module boundary, dependency direction, duplication, leakage, state
  ownership, or testing pain from the review>

## Target Shape

- <desired module boundary, interface, adapter, ownership rule, consistency
  rule, or test seam from the review>

## Vertical Slices

- [ ] <slice title>
  - Architecture outcome: <what design shape is improved>
  - Acceptance signal: <observable code, test, or documentation signal>
  - Preserves: <review intent that must not be dropped>

- [ ] <slice title>
  - Architecture outcome: <what design shape is improved>
  - Acceptance signal: <observable code, test, or documentation signal>
  - Preserves: <review intent that must not be dropped>

## ADR / Concept Candidates

- <decision or domain concept that may need durable documentation>

## Out Of Scope For This Plan

- <technical or product detail intentionally deferred>
```

## Writing Rules

- Preserve review-language signals such as "module", "seam", "adapter",
  "leakage", "state ownership", "lock rules", "consistency rules", and
  "test leverage" when they are present.
- Prefer architecture outcomes over product outcomes, while still noting user
  impact when it clarifies why the refactor matters.
- Make vertical slices independently reviewable and mergeable.
- Include acceptance signals that can falsify the plan, such as a new interface,
  moved responsibility, narrower dependency, regression test, ADR, or concept
  update.
- Do not mark a planning document implemented unless every preserved review
  intent is represented by shipped code or durable docs.
- Do not publish issues or PRDs from this skill; later skills handle that.

## Gap Check

Before finishing, compare the generated plan back to the source review item:

- Did every review problem become either a vertical slice, target-shape point,
  ADR/concept candidate, or explicit out-of-scope item?
- Did the plan preserve technical review intent instead of flattening it into
  product behavior only?
- Would a future implementer know which architecture concern remains unsolved
  after completing only one slice?

If the answer to any check is no, revise the plan before handing off.

## Handoff

After writing the file, summarize the review finding name, output path, and
number of vertical slices. Recommend the next workflow step based on the plan:
use `grill-with-docs` to resolve trade-offs, `to-issues` to publish independent
implementation slices, or `document-architecture-decision` after the work ships.
