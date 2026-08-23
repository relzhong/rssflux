---
name: conversation-to-planning
description: >-
  Convert a long, implementation-rich design conversation into a lossless planning document while preserving decisions, rationale, constraints, rejected alternatives, code references, and unresolved questions. Use after extended planning, grilling, architecture discussion, or whenever sketch-to-planning would discard important technical detail.

targets:
  - '*'
---

# Conversation To Planning

## Purpose

Turn an implementation-rich conversation into `docs/planning/<feature-title>.md` without flattening it into a product-only sketch.

Use this after `grill-with-docs`, or directly when the conversation already contains settled requirements and technical detail. Do not use it for a fresh one-line idea; use `sketch-to-planning` instead.

## Workflow

1. Read the full relevant conversation and any planning file, ADR, concept doc, domain glossary, or code path it references.
2. Check factual claims against the codebase when they can be resolved without asking the user.
3. Build a coverage ledger of every substantive requirement, decision, rationale, constraint, implementation detail, rejected alternative, and open question.
4. Classify each item as `Confirmed`, `Proposed`, `Assumed`, `Open`, or `Rejected`. Do not silently promote suggestions or agent recommendations to confirmed decisions.
5. If the conversation continues an existing planning file, update that file rather than creating a duplicate. Preserve still-valid content and clearly supersede changed decisions.
6. Otherwise derive a 3-7 word lowercase kebab-case title and write `docs/planning/<feature-title>.md`. Append `-2`, `-3`, etc. if an unrelated file already uses that name.
7. Draft an implementation-aware plan using the shape below. Include exact schemas, APIs, modules, paths, migrations, or operational details when the conversation actually settled them.
8. Run the coverage check before finishing and revise until every ledger item has an explicit disposition.

## Output Shape

```markdown
# Implementation Planning: <feature name>

## Objective

## User Journeys

## Confirmed Requirements

## Architecture and Implementation Decisions

### <decision>

- Status: Confirmed | Proposed | Assumed
- Decision:
- Rationale:
- Consequences:
- Relevant code or docs:

## Constraints and Invariants

## Data and Interface Changes

## Rejected Alternatives

## Open Questions

## Vertical Slices

- [ ] {slice title}
  - User outcome:
  - Implementation scope:
  - Acceptance criteria:
  - Verification:
  - Preserves:

## Migration and Rollout

## Documentation Impact

## Deferred Scope

## Conversation Coverage

- Requirements captured: <count>
- Decisions captured: <count>
- Open questions captured: <count>
- Rejected alternatives captured: <count>
```

Omit empty sections only when the conversation contained no relevant information. Never omit `Open Questions`, `Vertical Slices`, or `Conversation Coverage`.

## Writing Rules

- Preserve rationale and negative decisions, not only the chosen solution.
- Separate user-confirmed decisions from agent proposals and inferred assumptions.
- Prefer precise repository terminology; surface conflicts with `CONTEXT.md` instead of normalizing them silently.
- Keep vertical slices independently implementable and trace each one to requirements or decisions it preserves.
- Record unresolved conflicts as open questions; do not invent closure.
- Link to existing ADRs and concept docs. List new ADR or concept candidates without creating them unless requested.
- Do not publish a PRD or issues from this skill.

## Coverage Check

Every substantive conversation item must appear as a requirement, decision, constraint, implementation detail, vertical slice, open question, rejected alternative, or explicitly deferred item. Re-read the source conversation against the draft; if any item has no disposition, revise the plan.

## Handoff

Report the output path, whether the file was created or updated, counts from `Conversation Coverage`, and unresolved questions. Recommend `to-prd` when product alignment is still needed, or `to-issues` when the plan is already execution-ready.
