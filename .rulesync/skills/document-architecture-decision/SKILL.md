---
name: document-architecture-decision
description: >-
  Document shipped implementation knowledge after a feature, refactor, or bug
  fix. Use when the user asks to record how the implementation works, log a
  finalized Architecture Decision Record, update CONTEXT.md, or save supporting
  domain notes under docs/concepts/.
---

# Document Architecture Decision

## Purpose

Capture Phase 5 implementation knowledge after code is merged or ready to close. Separate durable architectural decisions from explanatory notes so future agents can recover the project's current language, constraints, and trade-offs.

Use this after `/improve-codebase-architecture` when a refactor changes structure, or directly after a shipped implementation when the important work is documentation rather than more code cleanup.

## Workflow

1. Read the implementation diff, PR notes, planning file, related issues, and existing domain docs that are relevant to the change.
2. Read `CONTEXT.md` if it exists. If it does not exist and the implementation introduces domain language, create it.
3. Read `docs/adr/` if it exists. If a finalized architecture decision should be logged, create the directory.
4. Read the relevant files in `docs/concepts/` before adding or updating concept documentation.
5. Decide whether the implementation contains an ADR-worthy decision or a concept-only explanation.
6. Update the smallest useful documentation set.
7. Summarize the files changed and the durable knowledge captured.

## Decision Routing

Write an ADR in `docs/adr/` when the implementation settles a meaningful architectural choice:

- It changes module boundaries, service ownership, data ownership, contracts, schemas, persistence, messaging, concurrency, security, deployment, or integration strategy.
- It chooses one option over credible alternatives.
- It creates a rule future work should obey.
- It reverses, supersedes, or narrows an earlier decision.

Update `CONTEXT.md` when the implementation changes the shared project language:

- Add or refine domain terms, invariants, architectural boundaries, cross-cutting rules, and current system truths.
- Keep entries concise and durable. Avoid dumping implementation chronology.
- Link to the ADR or concept doc that contains the fuller explanation.

Write or update `docs/concepts/` when the knowledge is useful but not an architecture decision:

- It explains how a subsystem works, how a workflow is shaped, or how future contributors should understand a domain area.
- It records implementation notes without a decision between alternatives.
- It is too detailed for `CONTEXT.md` and not consequential enough for an ADR.

If there is no relevant ADR, do not force one. Save the explanation to `docs/concepts/<topic>.md` instead.

## ADR Shape

Use a numbered, content-named file:

```text
docs/adr/0001-<decision-name>.md
```

If ADRs already exist, continue the next number. If not, start at `0001`.

Use this structure:

```markdown
# ADR <number>: <Decision Title>

## Status

Accepted

## Context

<What pressure, feature, bug, or constraint made this decision necessary.>

## Decision

<The concrete choice the implementation finalized.>

## Consequences

- <Positive or enabling consequence>
- <Trade-off, constraint, or follow-up risk>

## Links

- <Planning file, issue, PR, concept doc, or code reference if available>
```

## Concepts Shape

Use content-named lowercase kebab-case files in `docs/concepts/`.

For new concept docs, prefer this structure:

```markdown
# <Concept Title>

## Purpose

<Why this concept exists in the product or codebase.>

## Current Shape

<How it works now.>

## Important Rules

- <Durable rule future work should know>

## Related Docs

- <ADR, planning file, issue, or code reference if available>
```

## Writing Rules

- Prefer present-tense system truths over session notes.
- Write for the next agent or maintainer, not for an audit log.
- Keep `CONTEXT.md` short and navigational; put detail in ADRs or concepts.
- Preserve existing terminology unless the implementation intentionally renamed it.
- Do not document speculative plans as accepted decisions.
- Do not modify product planning files unless the user asks for planning updates too.
