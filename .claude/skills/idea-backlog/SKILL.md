---
name: idea-backlog
description: >
  Use this skill whenever the user in this project wants to brainstorm, discuss, evaluate,
  or continue thinking about a new idea, feature, direction, or pivot — phrases like
  "アイデアを検討したい", "新しい機能を考えたい", "こういう案はどうか", "発展させられそうな案",
  "ピボット先", "このアイデアについて話したい", or any open-ended "何を作っていくべきか" /
  "what should we build next" question, in any area of the project (not just score機能).
  ALWAYS consult this skill BEFORE proposing new ideas from scratch or diving into a fresh
  brainstorm — there is an accumulating Idea Backlog in docs/wiki and docs/raw, and a related
  idea, piece of research, or explicit user-interest signal may already exist and should be
  surfaced or built on rather than re-derived. Also use this skill when the user wants to save,
  log, or record a new idea ("記録しておいて", "積んでおきたい", "まとめておきたい"), since it
  defines the file format, naming convention, and index-update steps to follow.
---

# Idea Backlog

This project accumulates candidate ideas (new features, pivots, growth directions) as an
**Idea Backlog** instead of letting them evaporate at the end of a conversation. The backlog
lives across three layers, following this repo's LLM Wiki convention (see `AGENTS.md`):

- **docs/wiki/idea-backlog.md** — the single top-level index for the whole backlog. It exists
  purely so you don't have to grep every wiki page to answer "what ideas are outstanding" —
  it holds one row per area (area name, link to that area's page, a one-line summary) and
  nothing else. This is your first stop, both for reading and for writing.
- **docs/wiki/&lt;area&gt;.md** — per-area pages (e.g. `score-general-availability.md`,
  `highschool.md`, `data-model.md`, `open-questions.md`), each with its own "Idea Backlog" /
  "発展候補アイデア一覧" section. This is where the actual per-idea detail rows live (status,
  one-line purpose, link to the raw file) — `docs/wiki/idea-backlog.md` only summarizes these,
  it doesn't duplicate them.
- **docs/raw** — one dedicated file per idea, named `docs/raw/YYYY-MM-DD-idea-<slug>.md`.
  This is where the actual thinking lives (status, purpose, direction, open problems).

Why this matters: ideas discussed in chat and never written down get re-derived from zero next
time, which wastes the user's time and yours. An idea already in the backlog might already have
research, a chosen direction, or — most importantly — a note on **why the user personally found
it interesting**, which is exactly the signal you want when deciding what to work on next.

## Step 1: Check the backlog before doing anything else

Before brainstorming something new, or before treating a request as if it starts from zero, look
for existing backlog entries related to the topic:

1. Read `docs/wiki/idea-backlog.md` first — it's a short table of every area that has a backlog,
   with a one-line summary each. If the user asks for a general "what ideas are there" summary,
   this table alone is often enough to answer directly, without opening every area page.
2. For any row that looks related to what the user is asking about, follow its link into the
   area page (e.g. `score-general-availability.md`) and read that page's full "発展候補アイデア
   一覧" section — the area page is the source of truth for per-idea detail, `idea-backlog.md`
   only summarizes it.
3. Treat `docs/wiki/idea-backlog.md` as possibly stale (it's a hand-maintained summary, not
   generated). If it doesn't mention an area you'd expect to have ideas, fall back to
   `grep -rl "Idea Backlog\|発展候補アイデア" docs/wiki/` to double-check nothing was missed,
   and repair the index while you're there (see Step 3/4).
4. For any row that looks related to what the user is asking about, read the linked
   `docs/raw/*-idea-*.md` file. Pay special attention to the **"ユーザーが興味を持った点"**
   section if present — this records the user's own words about why they cared, which should
   weigh heavily in how you prioritize or frame follow-up work.
5. Also check `docs/wiki/open-questions.md` for related open threads that aren't full ideas yet.

If something relevant exists, say so and start from there — summarize its current status instead
of re-explaining the idea from scratch, then ask whether the user wants to continue that thread
or is intentionally asking for something new/different.

## Step 2: Working the conversation

This project's ideas usually go through a divergent phase before anything is decided (see
`AGENTS.md`'s "Preferred workflow": Conversation → Draft specification → Clarification → Wiki
update → Implementation → Documentation sync). Match your depth to where the user actually is:

- If the user is exploring/riffing, stay conversational. Don't force a full spec — a habit from
  this project is explicitly saying "still divergent, don't over-detail" and meaning it.
- If the user says something like "面白い" / "やりたい" / "1つやりたい" about a specific
  angle, that's a strong signal — note it verbatim for Step 3's interest section rather than
  paraphrasing it away.
- Ground exploration in the actual codebase/data where possible (this project has a habit of
  validating ideas against real data — e.g. running a quick analysis over existing records rather
  than reasoning purely in the abstract). It's fine to do real research (web search, reading
  actual repo data) before concluding — that's the norm here, not an exception.

## Step 3: Writing a new idea to the backlog

When an idea is ready to be recorded (the user asks to save it, or a thread has clearly
crystallized into something worth remembering), create `docs/raw/YYYY-MM-DD-idea-<slug>.md`
using today's date and a short kebab-case slug. Use this structure (see existing files under
`docs/raw/2026-07-11-idea-*.md` for real examples):

```markdown
# アイデア: <title>

## 状況
Idea Backlog。発散フェーズ / 検討中 / 等、現在地を一言で。日付を明記する。

## 目的
なぜこのアイデアが存在するのか。何を解決したいのか。

## ユーザーが興味を持った点
(あれば) ユーザー自身が「面白い」「やりたい」等と言った発言をできるだけ原文のまま引用する。
無ければこの節は省略してよい。

## 想定運用 / なぜこのスコープか
(あれば) 具体的な運用イメージ、このスコープを選んだ理由。

## わかっていること
既存の調査・データ・実装から確認できている事実。憶測は Assumption と明記する。

## 課題・未解決
まだ決まっていないこと、次に検証すべきこと。

## 目指したい方向性
次にどちらへ育てたいか。まだ確定していないなら「まだ発散フェーズ」と明記してよい。

## 関連
姉妹アイデア、関連する docs/wiki ページ、ADR、関連コードへのリンク。

## 参考文献
(あれば) 外部情報源のURL。
```

Keep it as a clean, purpose-readable one-pager — not a chronological chat log. If the
conversation that produced this idea also contains a lot of research/back-and-forth worth
preserving verbatim, that can stay in a broader research log file, but the idea file itself
should be skimmable in under a minute.

After creating the file, update the relevant area page's Idea Backlog table with a new row
(one-line summary + link). If no such table exists yet in the relevant wiki page, add one
titled `## 発展候補アイデア一覧（Idea Backlog）`, following `docs/wiki/score-general-availability.md`
as the template — and because this is a new area, also add a new row for it to
`docs/wiki/idea-backlog.md`'s index table (area name, link to the page, one-line summary).

Then sync `docs/wiki/idea-backlog.md`: update that area's one-line summary so it reflects the
idea you just added (or add the row if the area is new, per above). This is the step that's
easiest to forget because the "real" work already feels done once the raw file and area page
are written — but skipping it is exactly how the index drifts out of date and stops being
trustworthy for Step 1 next time.

Follow `AGENTS.md`'s write-back rule: if you deliberately leave something out of the wiki
summary (too speculative, redundant, out of scope for the index), note that exclusion with a
reason in the raw file's own "Compile Log" section — don't just silently drop it.

## Step 4: Updating an existing idea

If new research or discussion adds to an idea already in the backlog, edit its existing
`docs/raw/*-idea-*.md` file directly rather than creating a duplicate. Append new sections
(e.g. a second "ユーザーが興味を持った点" note, or an expanded "わかっていること") rather than
rewriting history, consistent with this repo's "raw is append-only" convention.

If the update changes the idea's status in a way that's visible from the outside (e.g. 発散
フェーズ → 実装済み, or a milestone completes), update the row in the area page's Idea Backlog
table too — and if that shift is significant enough that the one-line summary in
`docs/wiki/idea-backlog.md` would now read as stale or misleading, update that summary as well.
Small in-progress detail changes don't need to ripple all the way up; a status/phase change that
would mislead someone skimming just the top-level index does.
