# Contributing

This file covers what nothing else does: getting the repository running on your
machine, the commands worth knowing while you work, and how a change gets
released. Everything about HOW to write the change lives elsewhere and is not
repeated here:

- **[`AGENTS.md`](./AGENTS.md)** — the router. Which document owns which rule, the
  change flow, and what holds everywhere. Read it once before your first change.
- **[`skills/`](./skills)** — the canon, one folder per rule. `AGENTS.md` routes to
  the right one by task.
- **[`README.md`](./README.md)** — what the packages are, what is promised, and why
  a plugin uses a peer dependency.

## Setup

```bash
node --version      # 20.19 or newer
corepack enable     # pnpm 10.15, pinned by packageManager
pnpm install
pnpm check          # a few minutes; this is what CI runs
```

> [!IMPORTANT]
> **This repository needs pnpm; the packages it publishes need nothing.** The
> workspace uses `workspace:^` links and `pnpm-workspace.yaml`, and the lockfile
> is pnpm's. A consumer installs the published packages with npm, yarn, pnpm or
> bun and never learns which one built them.

If `pnpm check` is not green on a clean checkout, stop and say so — it is the
baseline every other instruction here assumes.

On Windows, enable long paths once (`git config --global core.longpaths true`);
some nested package paths exceed the default limit.

## While you work

`pnpm check` takes minutes. Run the narrow thing in the loop and the whole thing
before you commit:

```bash
pnpm --filter <package> test              # one package's suite
pnpm --filter <package> test:coverage     # its ratchet
pnpm --filter <package> bench             # its numbers
node scripts/check-<rule>.mjs             # one canon gate
npx vitest run scripts/                   # the gate specs
npx tsc -p tsconfig.json --noEmit         # types, whole monorepo
npx eslint . --max-warnings=0             # a warning is a failure here
```

Two things that look like a pass and are not: a `pnpm --filter` that matches no
package exits 0, and so does a vitest path filter that matches no file. If you
narrowed, check the count.

## Changing a package's manifest, README or tsconfig

You do not edit those files. They are generated from
[`scripts/registry.mjs`](./scripts/registry.mjs); edit the registry and run
`node scripts/scaffold.mjs`. `pnpm run check:drift` fails on a hand edit, and runs
first in CI so a divergence cannot reach npm.

The same holds for `CLAUDE.md` (generated from `AGENTS.md`), `api/*.api.md`
(`pnpm run check:api:write`) and `perf/*.perf.md` (`pnpm run check:perf:write`).

## Adding a published name

It is a promise kept until a major version, so it goes through
`skills/surface/SKILL.md` before it is written — tier, form, parity, the API
report, and a playground scene. `pnpm run check:api` refuses a name without one.

## Tests and coverage

Each package's `vitest.config.ts` carries coverage thresholds with the
measurement that set them written above. They are a ratchet: they may rise when
you measure a higher floor, and they are never lowered to make a run pass. If
your change drops coverage, the missing test is the fix.

## Benchmarks

Numbers are in **yardsticks** — how many `lankaBenchCalibration()` calls one
operation costs — never hertz, because hertz is a fact about one machine on one
afternoon. Before claiming any speedup, run the three-run A/B protocol in
`skills/performance/SKILL.md`. "Within noise" is a legal and frequent answer.

`pnpm run check:perf` is **not** part of `pnpm check`, and that is deliberate:
every other check reads files and answers the same anywhere, while this one
measures. Run it on an idle machine — a laptop mid-build reports twenty
regressions across eight packages over an unchanged tree, controls included. CI
runs `check:perf:report`, which prints the ratios and never fails, so the numbers
are in the log without a build server pretending to hold a stopwatch.

## Commits and pull requests

`skills/commits/SKILL.md` owns the message. In short: the subject makes a claim
that could be false, the body says what was wrong and why THIS shape, what you
deliberately did not do is stated rather than omitted, and every number was
measured three times.

CI runs `check:drift` and then `pnpm check` — the same command you ran locally,
so a local green and a remote green mean the same thing. There is nothing extra
to satisfy in the pull request beyond what the chain already proves.

Everything in this repository is written in English: code, comments,
documentation and commit messages. `pnpm run check:docs` enforces it.

## Releasing

Versions come from [changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset            # describe the change and pick the bump
pnpm run version:packages # apply it to the manifests and CHANGELOG
```

Only CI publishes, and only on a `v*` tag — the npm token lives in repository
secrets rather than in anyone's `~/.npmrc`, and the undo window is 72 hours and
exists once. The workflow runs `check:drift`, `check`, `check:publishable` and a
`--dry-run` publish before the real one; a tag is no reason to skip a gate, and
the real publish carries `--provenance`, so every tarball on npm is signed with
the repository, the commit and the workflow run it came from.

The scope on npm is `@lankajs/*` while the framework, the core package and every
symbol are `lanka`. That is a registry constraint rather than a name — see
`skills/naming/SKILL.md` §4.

### Cutting one

1. **Read the facade, as a person.** `api/*.api.md` is the whole published
   surface in nineteen short files, and a name there is kept until a major
   version. Ask of each: would I want to type this in my own application?
2. **Record `perf/` on an idle machine.** `pnpm run check:perf` twice; record with
   `check:perf:write` only if the two runs agree. A machine doing something else
   reports every operation as regressed, and a baseline written from such a run
   bakes noise into a ratchet that only tightens.
3. **Check the tarballs.** `pnpm run verify:build` installs each one into a
   temporary project and imports it in plain node — the one check that catches an
   `exports` map that does not match `dist`, or a missing `.d.ts`. It also reads
   the `"use client"` directive out of the built `lanka/viewmodel`, which a
   consumer's Next build depends on.
4. **Write the changeset and tag.** `pnpm changeset`, `pnpm run version:packages`,
   then push the tag. The tag is the only trigger.

## Working with an agent here

`.claude/agents/` holds the roster and `.claude/commands/` the flows — `/check`,
`/phase`, `/surface`, `/bench`, `/canon`, `/commit`, `/review`, `/scaffold`. They
encode the same rules this file points at, so a session that follows them
produces the same result as a person who read the canon.
