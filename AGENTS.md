# AI Collaboration Rules

## Documentation rules

- This repository uses docs/raw as the source for unstructured discussion notes and docs/wiki as the curated project wiki.
- Do not delete or rewrite docs/raw content unless explicitly requested.
- When changing code, confirm whether related docs/wiki and docs/adr need updates.
- When changing backend, database, Android, billing, analytics, score-analysis behavior, score features, data model, public pages, deployment, import scripts, or analysis logic, check whether docs/wiki needs updates.
- When implementation and docs conflict, implementation is the source of truth.
- Mark uncertain content as Assumption.
- Mark outdated content as Deprecated instead of silently deleting it.
- Keep Open Questions in docs/wiki/open-questions.md.
- Add ADRs only for important architectural decisions.
- Prefer concise Japanese documentation.

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

Create or update ADRs when changing:

- architecture
- data flow
- synchronization behavior
- timezone handling
- monetization logic
- public API contracts
- analysis methodology

---

## Preferred workflow

Conversation
→ Draft specification
→ Clarification
→ Wiki update
→ Implementation
→ Documentation sync
