# Documentation

How every comment, docblock, README and skill in this repository is written.
Enforced by `scripts/check-docs.mjs`, part of `pnpm check`.

## Language

**English. Everywhere.** Identifiers, comments, docblocks, READMEs, skills, test
titles, commit-visible strings, runtime error messages.

One language because the audience is mixed — contributors, npm consumers, and
coding agents — and a two-language corpus makes every reader translate half of
what they read.

## Audience

**Comments are read by agents and by people who are about to change the code.**
They are working context, not an essay. Optimise for the reader who has the code
in front of them and needs the part the code cannot state.

## What a comment must carry

State the things that are true and not derivable from the code:

| Carry                | Example                                                       |
| -------------------- | ------------------------------------------------------------- |
| **Constraint**       | `caches.open` must stay lazy — it throws in insecure contexts |
| **Invariant**        | retry wraps the signature, never the other way round          |
| **Contract**         | returns `null` when unavailable; callers choose the fallback  |
| **Platform fact**    | iOS private mode never settles `indexedDB.open()`             |
| **Ordering**         | host applies before services — a service may fire a request   |
| **Non-obvious cost** | each live object URL pins its blob until revoked              |
| **Deliberate risk**  | swallows failures; `persist` turns a rejection into a crash   |

## What a comment must not carry

- **Narrative history.** "This used to live in `SessionViewModel`", "we moved it
  in phase 4", "the previous attempt did X". The diff owns that.
- **Restated mechanics.** If the line says `if (!active) throw`, do not write
  "throws when there is no active instance".
- **Measurements without a consequence.** A number is worth writing only when it
  changes what a reader may do.
- **Apology or self-reference.** "unfortunately", "as mentioned above", "note
  that".

**A defect is stated as a rule, not as a story.** Not "a rejected request that
never decremented disabled prefetching for the rest of the session, which we hit
in production" — write "decrement in `finally`: a rejected request must not leak
a permanent +1".

## Superseding a name

A name that is replaced keeps working, and the tag that says so carries four
facts: the tag, `since <version>` — the version the REPLACEMENT shipped in —
`use <name>`, and one clause of why. Anything less is an apology: it tells a
reader something is wrong and nothing about what to do.

Why the rule is not "remove it": once a package is published, removal is the
expensive option and the superseded name IS the compatibility promise.
`skills/surface/SKILL.md` §7 owns the ladder, the ledger and the one case in
which removal is allowed at all. Enforced by `scripts/check-docs.mjs`, in code
files only — prose quoting the tag is citing the rule, not making a promise.

## When history is allowed

Only when the past changes what the reader may do NOW:

- A name or path is permanent for compatibility → say why it cannot change.
- A rejected alternative would otherwise be re-attempted → name it in one line.
- A check exists because its absence was silent → one clause, not a paragraph.

Cap it at one sentence. If it needs a paragraph, it belongs in `CHANGELOG.md`.

## Length

- One-line docblock for anything whose contract fits on a line.
- Multi-line only when a constraint, an ordering or a risk needs stating.
- Never repeat in prose what the signature already types.

## Scope of a docblock

| Place               | Answers                                             |
| ------------------- | --------------------------------------------------- |
| File docblock       | what this unit is, and its one non-obvious property |
| Symbol docblock     | contract: inputs, result, failure, ordering         |
| Inline comment      | why THIS line is not the obvious one                |
| Package `README.md` | what the package is, how to wire it, its boundaries |
| `skills/*/SKILL.md` | a rule that holds across packages                   |

Each fact has exactly one owner. A second copy is the one that goes stale.

## Test titles

A title states the behaviour being pinned, not the method being called:
`"serves the network URL when blob URLs are unavailable"`, not `"getInitialSrc
works"`.

## The escape marker

A line carrying `check-docs:allow` is exempt from both rules. It exists for the
two cases where the pattern IS the subject: `scripts/check-docs.mjs` itself, and
fixture data asserting a non-Latin round-trip.

The marker must sit on the offending line, not above it. Grep for it before
adding one — every occurrence is a line the check does not run on, and an escape
hatch that spreads turns the check into one that cannot fail.

## A consumer guide

`<pkg>/GUIDE.md` is written for somebody building an application, who has never
read this repository and never will. The shape is taken from documentation that
teaches well — react.dev's learn pages — and it is the same in all nineteen so a
reader who has read one knows where to look in the next.

| In order                    | What it holds                                             |
| --------------------------- | --------------------------------------------------------- |
| Intro                       | One paragraph: what the package is for                    |
| `## You will learn`         | Three to five bullets, in the order the page teaches them |
| `## When to reach for this` | The adoption decision, including when NOT to              |
| … the body …                | Problem first, then the shape that solves it              |
| `## Recap`                  | The five things worth remembering, as bullets             |

**Callouts are GitHub alerts**, because they render on GitHub and degrade to
plain blockquotes everywhere else:

- `> [!NOTE]` — a convention, or something true that is easy to miss.
- `> [!TIP]` — the better of two workable choices.
- `> [!WARNING]` — the mistake this page exists to prevent.
- `> [!IMPORTANT]` — a constraint the reader cannot discover by trying.

A long aside goes in `<details><summary><b>Deep dive:</b> …</summary>`, which
keeps a page skimmable while leaving the reasoning one click away.

**Say which advice binds.** A guide describes a framework people adapt, so every
page distinguishes what is checked from what is merely recommended, and
`ARCHITECTURE.md` grades all of it — `Checked` / `Recommended` / `Taste`. A
recommendation stated as a rule is how a consumer ends up fighting the framework
instead of configuring it.

## A shipped skill

`<pkg>/skills/lanka-<slug>/SKILL.md` is read by an agent, and the economics are
different from a guide's: **every skill's description sits in context always, and
a skill's body stays there for the rest of the session once loaded.** So:

- **The description states what it does and when to load it**, key use case
  first. It is capped at 1 536 characters in the listing, and the cap is not the
  target — nineteen descriptions at 350 characters already cost a page.
- **The body stays under 500 lines**, and in practice under 150. Detail belongs
  in `reference.md` beside it, which is the package's guide, generated.
- **State what to do.** A refusal keeps its reason in one clause, because an
  agent that cannot see why a refusal exists will "fix" it; everything else drops
  the narration.
- **Frontmatter uses the spec's fields only** — `name`, `description`, `license`,
  `metadata`, `allowed-tools`, `compatibility`. Anything else is rejected by
  claude.ai uploads and the Skills API. `scripts/skills.mjs` writes the
  provenance keys; the author writes the first two.

### Every name in a snippet exists

An agent that loads a skill writes code from its examples, so a snippet naming
something no package publishes produces code that looks idiomatic and does not
compile — worse than no skill, because the reader trusted it.

`check-llms.mjs` reads every fenced block in every shipped skill and compares its
branded identifiers against the surface, through `check-api.mjs` rather than
through `api/*.api.md`. Tag: `[skill-teaches-unknown-name]`. Prose is not read:
prose says `ALankaX` to mean "any role", and nobody pastes prose.

Three tokens are not API names and never count — `lanka` the package, `lankajs`
the npm scope, `lanka_di` the alias an application publishes to the framework.

## What a machine reads

Two artefacts in this repository have no human reader, which is exactly why they
rot: `llms.txt` at the root, and `.claude-plugin/marketplace.json`.

**`llms.txt` is the repository addressed to a model.** A model answers "how do I
do X in Y" far better than it volunteers an unknown Y, so the question worth
winning is the one where the name is already typed — and what decides the answer
there is whether the documentation can be RETRIEVED whole. It is generated from
the registry, follows llmstxt.org, and holds only links: an index rather than a
copy, because a second copy of the prose is a second thing to keep true. Every
document it names is flat markdown at a predictable path, and the examples it
points at are the `_playground/` scenes, which compile and run in CI.

**The shipped `reference.md` carries three facts a guide never states**: which
version it describes, the exact install line including peers, and where the
complete code is. Generated, because the version changes every release and
nineteen hand-kept version lines are nineteen chances to name the wrong one.

`check:llms` fails on a dead link, a package the index forgot, a version it does
not claim, an index a hand edited away from its generator, a marketplace entry
with no plugin manifest or no skills, and a package nobody can install.
