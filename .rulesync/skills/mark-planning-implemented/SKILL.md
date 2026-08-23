---
name: mark-planning-implemented
description: >-
  Add a final implemented status note to an existing `docs/planning/` markdown
  file after the planned work has shipped. Use when the user wants to mark a
  planning doc as finished, preserve the original plan as historical intent,
  and link to the resulting GitHub issues, ADRs, concept docs, PRs, or other
  durable implementation references.
---

# Mark Planning Implemented

## Purpose

Close the loop on a planning document without moving or rewriting it. Keep
`docs/planning/` as the record of original intent, and add a short status block
at the top that points future readers to the implemented work and current
system contracts.

Use this after implementation, issue closure, and any architecture/concept
documentation are complete.

## Workflow

1. Read the target planning file under `docs/planning/`.
2. Inspect nearby implementation context only as needed: linked issues, git
   history, PR notes, ADRs, `docs/concepts/`, and `CONTEXT.md`.
3. Identify the smallest useful set of finished-work links:
   - GitHub issues or PRs that delivered the plan.
   - ADRs that record accepted decisions.
   - Concept docs that describe current behavior.
   - `CONTEXT.md` when shared language changed.
4. Add or update a status block immediately below the planning document title.
5. Preserve the original planning content except for marking completed vertical
   slices when that is clearly supported by the implementation record.
6. Summarize the planning file updated and the implementation references added.

## Status Block Shape

Use this shape directly below the top-level heading:

```markdown
> Status: Implemented
>
> Finished work:
> - GitHub Issue: <url or #number>
> - ADR: <relative link>
> - Concept: <relative link>
> - Shared language: <relative link>
```

Omit link categories that do not apply. Keep link labels stable and concrete:
`GitHub Issue`, `Pull Request`, `ADR`, `Concept`, and `Shared language`.

If there is already a status block, update it instead of adding a second one.
If the plan is only partially implemented, write `Status: Partially
Implemented` and list only the shipped references.

## Writing Rules

- Prefer present-tense outcome language over implementation chronology.
- Do not move the planning file to an archive directory unless the user
  explicitly asks.
- Do not convert the planning doc into an ADR or concept doc.
- Do not add speculative future work to the implemented status block.
- Keep the block short enough that the original planning title and intent remain
  easy to scan.
- Use relative links for repo docs and full URLs for external GitHub resources.

## Handoff

After editing, mention that the planning document remains in `docs/planning/`
as historical intent, while ADRs, concept docs, and `CONTEXT.md` hold the
current durable contract.
