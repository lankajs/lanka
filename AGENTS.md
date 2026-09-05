# lanka — the repository router

The entry point for anyone working here, human or agent. It routes; it does not
restate. Every rule below has ONE owner, and the owner is a `SKILL.md`.

`CLAUDE.md` is generated from this file — `node scripts/check-router-mirror.mjs
--write` — so the two cannot drift. Edit this one.

## What this repository is

A React application framework published as twenty-two npm packages: `lanka` (the
core), nine `@lankajs/*` modules, eight plugins, four tools. It is consumed by
applications, so almost everything here is a PROMISE: a name in a barrel is kept
until a major version.

```
core/                 the framework: bootstrap, gateway, viewmodel, scenario, locator, logger
modules/<name>/       optional capabilities an application installs one at a time
plugins/<name>/       things `lanka.use(…)` takes, occupying an extension point
tools/<name>/         eslint rules, the vite plugin, the test kit
skills/               the canon: one folder per rule, each a SKILL.md
scripts/              the executable half of the canon, plus the package registry
api/                  the published surface, checked in — the diff IS the review
perf/                 the hot paths' baselines, in yardsticks
_plans/               work in flight; empty is its normal state
.claude/agents/       the roster: one file per role
.claude/commands/     the flows: /check /phase /surface /bench /canon /commit /review /scaffold
```

## Start here, by task

| Doing this                                     | Read first                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| naming anything                                | `skills/naming/SKILL.md`                                             |
| adding or moving a file                        | `skills/structure/SKILL.md` — the bucket taxonomy is rule 5a-i and 9 |
| writing a function longer than a screen        | `skills/composition/SKILL.md`                                        |
| writing a comment, a README, a doc             | `skills/documentation/SKILL.md`                                      |
| exporting a new name                           | `skills/surface/SKILL.md` — the tiers, and what admission costs      |
| deciding class vs factory vs table vs function | `skills/forms/SKILL.md`                                              |
| adding a role, or a second style for one       | `skills/parity/SKILL.md`                                             |
| touching a hot path, or claiming a speedup     | `skills/performance/SKILL.md`                                        |
| integrating with Next, Expo or any host        | `skills/hosts/SKILL.md` — where a layer may run, and who owns what   |
| writing a test                                 | `skills/testing/SKILL.md`                                            |
| adding a check                                 | `skills/gates/SKILL.md`                                              |
| language questions                             | `skills/typescript/SKILL.md`                                         |
| writing the commit                             | `skills/commits/SKILL.md`                                            |
| starting multi-step work                       | `skills/plans/SKILL.md`                                              |
| using a package                                | that package's `GUIDE.md`                                            |
| advising on how to structure a consuming app   | `ARCHITECTURE.md` — and its `Checked`/`Recommended`/`Taste` labels   |
| changing one package's own code                | that package's `SKILL.md` — its invariants, and what to run          |
| changing what a CONSUMER's agent is told       | `<pkg>/skills/lanka-<slug>/SKILL.md`, and `scripts/skills.mjs`       |

Three documents sit in every package and answer three different questions:
`README.md` is "what is this and why is it shaped this way", `GUIDE.md` is "how
do I use it", `SKILL.md` is "what may I not change in it". A rule true of ONE
package lives in that package's `SKILL.md`; a rule true of all of them is a
skill above, and is never copied down.

**Three things here are called a skill, and they have three readers.**
`skills/<rule>/SKILL.md` is this repository's canon and never ships.
`<pkg>/SKILL.md` is how to maintain that package and never ships.
`<pkg>/skills/lanka-<slug>/SKILL.md` is what a CONSUMER's agent loads, and is the
only one that ships — through the plugin marketplace in `.claude-plugin/` and
inside the npm tarball. `reference.md` beside it is the package's `GUIDE.md`,
generated; the skill itself is written by hand, because a decision procedure
cannot be derived from a document written to be read top to bottom.

`CONTRIBUTING.md` answers the one question no skill does: how to get the
repository running, and how a change is released.

## The flow

Every change goes the same way, and the harness commands under `.claude/commands/`
run it:

1. **Read the canon that owns the area.** Not the code first — the code says what
   is, the canon says what may be.
2. **Change one thing.**
3. **`pnpm check`.** It is the whole list: the lockfile, lint, typecheck, twelve
   canon gates, coverage, the script specs, the build, publishability. CI runs
   `check:drift` and then this same command, so a local green and a remote green
   mean the same. The lockfile is first because CI installs before anything else,
   and that step was once the only one nothing local could see.
4. **Measure, if a hot path moved.** `pnpm run check:perf`, on an IDLE machine.
   It is the one check outside the chain, because it is the one that measures
   rather than reads: a busy laptop and a two-core runner both report everything
   as regressed. CI prints the numbers without judging them
   (`check:perf:report`). The reason is `skills/gates/SKILL.md` §1, the protocol
   is `skills/performance`.
5. **Commit.** One change, one commit, with the reason and the numbers.

`pnpm check` takes minutes. Run the narrow thing while working — `pnpm --filter
<pkg> test`, `node scripts/check-<x>.mjs` — and the whole thing before committing.

## Rules that hold everywhere

1. **The canon owns the rule; the gate owns the enforcement.** If they disagree,
   one of them is a bug — say which, do not pick silently.
2. **A ratchet only tightens.** Coverage thresholds and `perf/` baselines move
   toward stricter. Raising one to make a run pass is the edit that ends the
   ratchet; add the test, record the faster number.
3. **A published name is never removed.** `api/*.api.md` is the record; deletion
   is a major version and a decision, not a cleanup.
4. **Nothing in the framework imports from a consuming application.** The only
   inward direction is `@lanka_di/*`, the barrels an application publishes to the
   framework.
5. **Core knows nothing of modules and plugins. A plugin knows nothing of another
   plugin.** What two plugins share belongs in core, behind an extension point.
6. **A check that cannot fail reports success.** Prove a new gate fails before
   trusting it; delete a test that asserts nothing.
7. **Generated files are edited through their generator.** `README.md`,
   `package.json`, `tsconfig.json`, `tsup.config.ts`, `CLAUDE.md`,
   `api/*.api.md`, `perf/*.perf.md` and every package's `LICENSE` — edit the
   registry, the script or the root `LICENSE`, then regenerate. `check:drift`
   refuses a hand edit.

## When to spawn an agent

Below the line, work directly: a single-file change, a rename, a doc fix, reading
code to answer a question.

Above it — a change touching three or more packages, a new published surface, a
gate whose semantics change, a refactor that moves files — the roster in
`.claude/agents/` is the division of labour. Two economics decide how many:

- **Batch to find out, isolate to be sure.** Questions are cheap inside one agent
  and expensive across many, so gather context in ONE `scout` call. Verification
  is the opposite: `surface-architect`, `adversarial-reviewer` and `qa` run in
  fresh contexts, because a reviewer sharing a context with the writer has
  stopped being a review.
- **Verification an agent duplicates is a second bill.** If `pnpm check` already
  proves it, run the gate and skip the agent. Agents exist for what no gate can
  read: whether a contract is right, whether a name will age, whether the reason
  in a comment is true.

The ancestor repository this policy came from measured a subagent at ~43k tokens
of fixed cost before it does anything. That number is not from this repository —
treat it as an order of magnitude, not a fact about lanka.

## Conflict order

1. What the user asked for.
2. The skill that owns the rule.
3. This router.
4. Generic best practice.

When 2 and 3 disagree, the skill wins and this file is wrong — fix it here.
