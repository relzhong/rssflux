---
name: sketch-to-planning
description: >-
  Turn a raw feature idea, lazy product sketch, or Phase 1 product dump into
  a content-named markdown file under `docs/planning/`. Use when the user wants
  to capture what a feature does quickly, avoid technical trade-offs, and
  produce a high-level user journey plus independent vertical-slice todo list
  for later PRD, architecture, or issue generation work.
targets:
  - '*'
---

# Sketch To Planning

## Purpose

Convert a fresh feature idea into a lightweight planning skeleton under `docs/planning/`.

This is the repo's Phase 1 "lazy dump" workflow. Preserve momentum: capture product intent, user journey, and vertical slices without diving into schemas, APIs, file paths, implementation details, or technical trade-offs.

## Workflow

1. Read the user's raw idea from the current prompt or conversation.
2. If the idea is too vague to produce a useful skeleton, ask at most one clarifying question about user value or target audience.
3. Derive a short feature title from the skeleton content.
4. Convert the title to lowercase kebab-case and write `docs/planning/<feature-title>.md`.
5. If a file with that name already exists, append `-2`, `-3`, etc. rather than overwriting.
6. Keep the document product-facing and implementation-light.

## Filename Rules

- Use the feature's actual content, not a generic name.
- Prefer 3-7 words.
- Use lowercase ASCII letters, digits, and hyphens only.
- Remove filler words when the meaning remains clear.
- Examples:
  - "Magic-link authentication" -> `docs/planning/magic-link-authentication.md`
  - "Improve backend message flow" -> `docs/planning/backend-message-flow.md`
  - "WhatsApp support channel" -> `docs/planning/whatsapp-support-channel.md`

## Output Shape

Use this structure:

```markdown
# Todo Skeleton: <feature name>

## Raw Idea

<1-3 sentence restatement of the user's idea>

## User Journey

1. <high-level user step>
2. <high-level user step>
3. <high-level user step>

## Vertical Slices

- [ ] <slice title>
  - User outcome: <what the user can do after this slice>
  - Acceptance signal: <observable product behavior>

- [ ] <slice title>
  - User outcome: <what the user can do after this slice>
  - Acceptance signal: <observable product behavior>

## Out Of Scope For Phase 1

- <technical or product detail intentionally deferred>
```

## Writing Rules

- Prefer user outcomes over technical tasks.
- Make slices independently useful and shippable where possible.
- Avoid code blocks except the template above inside this skill.
- Avoid implementation specifics such as database schemas, RPC contracts, component names, migrations, and exact file paths.
- Mention deferred technical questions only in `Out Of Scope For Phase 1`.
- Do not publish issues or PRDs from this skill; later skills handle that.

## Handoff

After writing the file, summarize the feature name, output path, and number of vertical slices. Recommend the next workflow step: use `grill-with-docs` on the generated planning file to resolve technical trade-offs and ADRs.
