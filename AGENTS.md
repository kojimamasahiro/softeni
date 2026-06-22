# AI Collaboration Rules

## Documentation rules

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
