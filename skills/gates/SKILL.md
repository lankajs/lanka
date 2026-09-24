# Gates

Every canon in `skills/` has an executable half in `scripts/`. This is how one is
written, and what makes it worth running.

**A check that cannot fail reports success.** That sentence is the whole subject.
It is why a gate ships with a test that makes it fail, why an exemption list is
consulted rather than trusted, and why forty-five timing "tests" that printed a
duration and asserted nothing were deleted rather than kept.

## 1. One list

`.specwarden/checks/` IS the list, and `pnpm check` runs all of it through
[specwarden](https://www.npmjs.com/package/specwarden): the `fast` tier, then
the `heavy` one. `.github/workflows/ci.yml` calls that one script — not an
expanded set of steps — so a local green and a remote green cannot mean
different things.

Adding a gate is three edits and no fourth:

1. `scripts/check-<subject>.mjs`
2. `scripts/check-<subject>.test.mjs`
3. its entry in `.specwarden/checks/canon/canon.check.mjs` — the rule it
   enforces, the canon that owns it, and the success line that proves it looked

A gate outside the list is a script nobody runs. A step added to CI and not to
the list is a rule that only fails for other people. A `"check:<subject>"` alias
in `package.json` is a convenience for running one script by hand, and nothing
more: the chain that used to live there drifted from CI once already.

What the engine adds, and why it was worth a dependency: every check names the
rule it enforces (`specwarden doctor` fails an orphan); a wrapped script is
believed only beside its success line (`expect`), so a zero exit that printed no
count is a failure; and a `pnpm --filter` that matched nothing is refused by
name rather than passed. Each is a way this repository has watched a gate go
quietly green.

The engine needs Node 24 to run; the repository's floor stays what `engines`
says. A second CI job runs the suites and the tarball probe on that floor, so
the list runs on the tool's runtime and the packages are proved on theirs — a
floor nothing runs on is not one.

### The one exception, and what makes it one

`check:perf` is not in the list, and has no tier: `check --all` runs every
tier, so a tier is not a place to park something the list must not judge. Every
other gate READS FILES: the same tree
gives the same answer on any machine, which is exactly what makes a local green
and a remote green mean one thing. A benchmark MEASURES, and a measurement needs
an instrument — on a laptop mid-build or a two-core shared runner, unrelated
operations regress together, including the benches written to bypass the
framework. That was not a theory: the first CI run flagged three at ~2×, and a
busy laptop flagged twenty across eight packages, twice in a row, over an
unchanged tree.

So a measurement is judged where somebody chose to measure — `pnpm run
check:perf` on an idle machine, which is also the only place a baseline may be
recorded — and CI runs `check:perf:report`, which prints every ratio and exits
zero. The numbers stay in front of a reader; nothing pretends a build server can
hold a stopwatch. `.specwarden/rules.mjs` records the rule with that reason, so
the list's own audit still accounts for it.

The test for admitting a second exception: **can this check disagree with itself
on two runs over the same tree?** If no, it belongs in the list. If yes, it is a
measurement, and the list is not where it gets a vote.

## 2. The shape of a gate script

```js
/** What it checks, and the defect that produced the rule. Canon: skills/<x>/SKILL.md. */

export const readerOne = (source) => …;   // pure, exported, tested
export const readerTwo = (report) => …;   // pure, exported, tested

const problems = [];
const fail = (rule, where, message) => problems.push(`[${rule}] ${where}\n    ${message}`);

export const run = () => { …; return problems; };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	run();
	if (problems.length > 0) {
		console.error(`X DIVERGES FROM THE CANON (${problems.length})\n\n${problems.join("\n\n")}\n\nCanon: skills/<x>/SKILL.md`);
		process.exit(1);
	}
	console.log(`x follows the canon: <count> …`);
}
```

Four things that are not optional:

- **The readers are pure and exported.** The spec drives them directly. A gate
  whose logic is only reachable by running the whole repository can only be
  tested against today's repository, which is the one state where it passes.
- **A tag per rule.** `[kind-outside-its-bucket]`, `[perf-regressed]`. The tag is
  what a person greps for and what the canon's table lists.
- **The message says what to DO.** "belongs in `_abstractions/`" — not "invalid".
- **The success line carries a count.** `615 files`, `9 roles, 19 pairs`. A gate
  that says only "ok" cannot be caught silently checking nothing, and this
  repository has watched a glob match zero files and report success. The line is
  also the gate's `expect` in the list, written as a count that is not zero —
  reword it and the check goes red, which is the point.

## 3. Prove it fails, twice

Once in the spec, once by hand:

```bash
# break it on purpose, then:
node scripts/check-<subject>.mjs       # must exit 1 and name the rule
pnpm exec specwarden check <subject>   # and the list must fail with it
git checkout -- <the file>
```

The spec pins the readers; the hand run pins the wiring — the file list, the
`git ls-files` filter, the resolution of a relative path. Both have been wrong
here: a facade pattern that matched every package except `core`, a bench list
that skipped untracked files, a `vi.mock` string no import-rewriter could see.

### A gate over `git ls-files` cannot see your new file

Every gate that lists files through git is blind to whatever is untracked, so a
green run before the first `git add` says nothing about the files you just wrote.

**`git add -A`, then run the list.** Not a suggestion — it has been learned three
times: a new package with a whole `src/` in it, a test placed beside a unit the
structure canon wanted moved into a folder, and a new fifty-line function that
passed `check:composition` locally and failed it in CI on the same tree. The
third happened in the same change that wrote this paragraph, which is how
confidently the mistake repeats.

The counts in the success lines are the cheap second reading: `497 sources, 191
tests` should GROW when files were added. A number that stood still while the
tree grew is a gate that looked at yesterday.

## 4. Exemption lists are consulted, never trusted

Every gate that admits exceptions keeps them in one exported map with a reason
per entry, and checks the reason:

- `SUBCLASSABLE` in `check-forms` names the file whose header invites the class,
  and reads that header — an entry whose file stops explaining itself fails.
- `UNDEMONSTRATED` in `check-api` fails on a STALE entry: a name listed as
  undemonstrated that a scene now drives. A ratchet that only tightens is not a
  ratchet.
- `check-forms` fails on an admission for a class no facade publishes, because an
  exemption that can never be consulted is one nobody notices is wrong.

An exemption without a reason is a rule opted out of. An exemption list with no
check on itself is where a gate goes to die.

## 5. Ratchets

Coverage thresholds and `perf/` baselines are ratchets: the number moves toward
stricter, never away, and it carries the measurement it came from.

- **Never raise a threshold to make a run pass.** Add the missing test; record the
  faster number. Raising it is the one edit that turns a ratchet into a decoration.
- A threshold is the _measured floor minus one_. Two runs of an unchanged suite
  differ in the hundredths, and a number nailed to the best observation fails on
  a coin toss — a gate that cries wolf stops being read.
- The comment above a threshold states the measurement, not a target.

## 6. What a gate must not do

- **Do not delegate to a sibling repository or a global install.** A gate runs on
  what this checkout contains.
- **Do not pass a path filter that can match nothing.** `vitest run <path>` with
  no match exits 0; so does `pnpm --filter <not-a-package-name>`. If a filter is
  unavoidable, assert the count — in the list, `expect` on pnpm's `Scope:` line
  and `refuse` on its "No projects matched" sentence.
- **Do not swallow a pipe.** `grep -q` and `head -n` close the pipe early, and the
  producer dies with 141 — which reads as a pass under `pipefail`.
- **Do not check style a formatter already owns.** Prettier and ESLint are in the
  list; a gate exists for the rules they cannot express.

## 7. The gates, and what each owns

The id is what `specwarden check <id>` runs; the alias runs the script alone.

| Id            | Alias               | Canon                    | Answers                                                                     |
| ------------- | ------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `naming`      | `check:naming`      | `skills/naming`          | is it called what it is                                                     |
| `structure`   | `check:structure`   | `skills/structure`       | is it where its kind lives                                                  |
| `composition` | `check:composition` | `skills/composition`     | is the code inside it arranged                                              |
| `docs`        | `check:docs`        | `skills/documentation`   | one language, a deprecation that instructs, three documents per package     |
| `api`         | `check:api`         | `skills/surface`         | is the promise written down and demonstrated                                |
| `points`      | `check:points`      | `skills/surface`         | does every extension point have an occupant                                 |
| `family`      | `check:family`      | `skills/structure` 5d    | do a shelf's members stay one surface per vendor                            |
| `runtime`     | `check:runtime`     | `skills/hosts`           | does it run — and does it need a UI framework — where it says               |
| `forms`       | `check:forms`       | `skills/forms`           | is it a class, a factory, a frozen table or a function                      |
| `parity`      | `check:parity`      | `skills/parity`          | can both styles reach every role                                            |
| `playgrounds` | `check:playgrounds` | `_playgrounds/README.md` | do the applications still make the same claims                              |
| `llms`        | `check:llms`        | `skills/documentation`   | can a machine read this repository, and does a skill teach only real names  |
| `drift`       | `check:drift`       | `AGENTS.md`              | does the generated output match the registry                                |
| `router`      | `check:router`      | `AGENTS.md`              | is `CLAUDE.md` still `AGENTS.md` plus its header                            |
| `publishable` | `check:publishable` | —                        | would npm accept what this package claims                                   |
| `build`       | `verify:build`      | —                        | does an installed TARBALL resolve, execute and reach the consumer's barrels |
| —             | `check:perf`        | `skills/performance`     | did a hot path get dearer — outside the list, §1                            |

Beside them the list carries the toolchain (`lockfile`, `lint`, `typecheck`,
`bindings`, `apps`, `coverage`, `scripts`) and three checks it installs rather
than writes: `agent-definitions` over the roster in `.claude/agents/`,
`doc-paths` and `doc-hygiene` over every document, and `secret-scan` over every
tracked file. A module's check is configured in its file under
`.specwarden/checks/`, never re-implemented as a script here.

Read the canon before changing the gate. A gate edited to accept the code is a
canon edited by accident, and the diff does not say so.

**`verify:build` is the only gate that reads `dist`, so two questions are its
alone.** A package's external boundary is `dependencies` plus
`peerDependencies` and nothing else — an optional peer named only in
`peerDependenciesMeta` is not a peer, and the bundler inlines it, which is how
all five bindings shipped a copy of their testing library and React's copy threw
on import. And the set of packages BUILT must be the set packed: its build step
filtered `./modules/*`, one level deep, so the whole `bindings/` shelf was
verified against whatever `dist` a previous run had left. Both are derived from
`scripts/registry.mjs` now, and `scaffold.mjs` refuses the first outright.
