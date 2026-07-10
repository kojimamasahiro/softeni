# AI Collaboration Rules

## Documentation rules

This repository's docs/ follows an **LLM Wiki** pattern (Karpathy, 2026-04): raw sources are
**compiled** by an LLM into interconnected wiki pages that are **written back and accumulated**
over time, rather than re-derived from scratch each session. Concretely: docs/raw = raw sources
(uncompiled), docs/wiki = compiled/curated output (a secondary artifact — verify against
implementation, don't take it at face value), docs/adr = compiled record of important decisions.
Treat every research/brainstorm session as something that should get written back, not just
answered in chat and forgotten.

- This repository uses docs/raw as the source for unstructured discussion notes and docs/wiki as the curated project wiki.
- Do not delete or rewrite docs/raw content unless explicitly requested.
- When changing code, confirm whether related docs/wiki and docs/adr need updates.
- When changing backend, database, Android, billing, analytics, score-analysis behavior, score features, data model, public pages, deployment, import scripts, or analysis logic, check whether docs/wiki needs updates.
- When implementation and current-state docs (e.g. the wiki) conflict, implementation is the source of truth. This does NOT apply to an ADR's Context / Decision / Alternatives, which are a historical record — see ADR rules.
- Mark uncertain content as Assumption.
- Mark outdated content as Deprecated instead of silently deleting it.
- Keep Open Questions in docs/wiki/open-questions.md.
- Add ADRs only for important architectural decisions.
- Prefer concise Japanese documentation.
- After a research/brainstorm session or a significant implementation, run the write-back step:
  add/update the relevant docs/raw note, then compile the durable parts into docs/wiki
  (see docs/prompts/summarize-raw.md, docs/prompts/update-wiki.md). Periodically —
  and always after a significant implementation — run docs/prompts/review-docs-drift.md
  to catch wiki/implementation drift before it accumulates (see docs/raw/2026-06-25-wiki-audit.md
  for an example of what this catches if skipped).
- Write-back must record exclusions, not just inclusions. When compiling a docs/raw note into
  docs/wiki, explicitly note what was reviewed and deliberately left out (redundant, too
  speculative, out of scope for the target page, superseded, etc.), with a one-line reason each.
  Append this as a "Compile Log" at the end of the source docs/raw note (raw stays append-only).
  Without this, a future reader can't tell "reviewed and excluded on purpose" from "never reviewed" —
  both look like silence otherwise.
- When adding a new docs/wiki page, cross-link it: add it to docs/wiki/index.md and add at least
  one link from an existing related page. Wiki pages that aren't interconnected are effectively
  invisible to future compile passes.

---

## Before coding

Before implementing any feature or modifying behavior:

- Read related docs/wiki and docs/adr files.
- Check for existing architecture decisions and constraints.
- Check for deprecated or draft specifications.
- Do not assume missing requirements.

---

## Requirement clarification

If specifications are incomplete, contradictory, or ambiguous:

- Ask follow-up questions before implementation.
- Do not silently invent behavior.
- Present assumptions explicitly.
- Add unresolved items under `Open Questions`.

Critical logic must always be clarified before coding.

Examples:

- timezone handling
- reward unlock duration
- sync conflict resolution
- statistical formulas
- anomaly thresholds
- public/private visibility behavior

---

## Documentation sync

When implementation changes behavior:

- Update related wiki pages.
- Mark outdated sections as Deprecated.
- Add migration notes if necessary.
- Add or update ADRs when architectural decisions change.

---

## ADR rules

An ADR records _when and why_ a decision was made — it is not a description of the current code.

Create or update ADRs when changing:

- architecture
- data flow
- synchronization behavior
- timezone handling
- monetization logic
- public API contracts
- analysis methodology

How to keep ADRs accurate without losing history:

- "Implementation is the source of truth" applies to _current behavior_. Do NOT rewrite an ADR's Context / Decision / Alternatives to match the implementation — they are a historical snapshot of the reasoning.
- Manage state with the Status field (Draft / Accepted / Deprecated / Superseded).
  - While Draft, editing the body directly is fine.
  - After Accepted, if the decision changes, do NOT rewrite the body. Set Status to Superseded / Deprecated and record the new decision in a new ADR (or an appended note) so the decision history stays auditable.
- "Current-state" parts of an ADR (e.g. an Implementation Status section) SHOULD be kept in sync with reality.
- If the implementation drifted unintentionally, fix the implementation, not the ADR.

---

## Preferred workflow

Conversation
→ Draft specification
→ Clarification
→ Wiki update
→ Implementation
→ Documentation sync
