# Maintaining `@lankajs/tool-skills`

A CLI that copies the consumer skills out of installed packages into a project.
Small, and the only package in this repository that writes into somebody else's
repository — which is what every rule below is about.

## Boundary

- A **tool**: a dev dependency and a command. Nothing here ships in an
  application bundle.
- It imports nothing from this repository. It works on `node_modules` and a
  manifest, which is all it can know about a consumer.
- It decides nothing on the consumer's behalf beyond the copy. No config
  rewriting, no git, no install hooks.

## Invariants

1. **It never overwrites a directory it did not write.** Every directory it
   creates carries `.lanka-skill.json`; one without it is the consumer's —
   hand-written or from another source — and is reported rather than replaced.
   Overwriting it destroys work nobody asked this tool to touch, and the loss is
   silent: the file is simply different the next time it is read.

2. **The marker is written AFTER the copy, and last.** A marker beside a
   half-copied directory promises the next run that it may replace something
   that was never finished.

3. **A copy removes the destination first.** Copying over a previous version
   leaves files the new one no longer has, and a stale `reference.md` beside a
   current skill is the kind of wrong that reads as correct.

4. **There is no postinstall hook, and there must not be.** Writing into a
   consumer's repository is theirs to ask for; a hook would do it on every
   install, in CI and inside a container, and the first time anybody notices is a
   diff they did not make. The guide shows them how to add one themselves.

5. **The version comes from `node_modules`, never from the declared range.**
   That is the entire reason this transport exists beside the plugin
   marketplace. A skill teaching a version the application is not running is
   worse than no skill, because it is wrong confidently.

6. **Every decision is a function over a port.** `ILankaSkillHost` is the only
   thing that touches a file system, and `lankaNodeSkillHost` is its one
   implementation. What this tool REFUSES to write is the interesting property,
   and it must be an assertion rather than something discovered on somebody's
   repository.

7. **A conflict does not fail the run.** Everything possible was done, and the
   one thing refused is now a decision in front of the person who typed the
   command. An exit code would make a CI script fail over a file the consumer
   chose to keep.

8. **`src/cli.ts` is three lines, and is the only file that runs at import.** A
   bin must; every line that does is a line no test can reach without running the
   program. The command itself is a function next door, given its arguments, its
   root and both streams.

## Tests and coverage

Beside each unit, plus the `_playground/` scene: a project with core, a plugin,
the test kit and React, synced twice.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99 —
measured at 100 across the board, twice. Three exclusions, each with its reason
in `vitest.config.ts`: `_interfaces` (declarations), `_adapters` (covering it
would test `node:fs`), and `_testing` (counting a double's branches measures the
tests).

What must stay pinned, because each is an invariant above: a foreign directory
left alone, `--force` replacing it, the marker written after the copy, a dry run
writing nothing while answering the same plan, and a second sync reporting
updates rather than conflicts.

## Before you finish

```bash
pnpm --filter @lankajs/tool-skills test
pnpm --filter @lankajs/tool-skills test:coverage
node scripts/check-publishable.mjs   # the bin path in publishConfig
pnpm run verify:build                # a bin that points into src is a broken command
pnpm check
```

`verify:build` matters here more than in most packages: `bin` is rewritten from
`src` to `dist` by the scaffolder, and the failure — a command that works in the
monorepo and is broken in every installed copy — appears nowhere else.

## Traps

**Adding a "check for updates" feature.** It would need the network, a cache and
a policy, and the thing it replaces is `npx lanka-skills sync`.

**Making the tool write config** — a `settings.json`, a `.gitignore` line. Every
one of those is a file the consumer owns and did not ask about.

**Failing on a conflict.** See invariant 7.

**Testing against a real directory.** The fake host exists so the refusals are
assertions; a test that writes to a disk proves less and can leave a mess.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
