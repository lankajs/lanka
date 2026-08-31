# Gates

Every canon in `skills/` has an executable half in `scripts/`. This is how one is
written, and what makes it worth running.

**A check that cannot fail reports success.** That sentence is the whole subject.
It is why a gate ships with a test that makes it fail, why an exemption list is
consulted rather than trusted, and why forty-five timing "tests" that printed a
duration and asserted nothing were deleted rather than kept.

## 1. One list

`pnpm check` in the root `package.json` IS the list. `.github/workflows/ci.yml`
runs `check:drift` and then that one script — not an expanded set of steps — so a
local green and a remote green cannot mean different things.

Adding a gate is three edits and no fourth:

1. `scripts/check-<subject>.mjs`
2. `scripts/check-<subject>.test.mjs`
3. `"check:<subject>"` in `package.json`, and its name inside `"check"`

A gate outside that chain is a script nobody runs. A step added to CI and not to
the chain is a rule that only fails for other people.

### The one exception, and what makes it one

`check:perf` is not in the chain. Every other gate READS FILES: the same tree
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
hold a stopwatch.

The test for admitting a second exception: **can this check disagree with itself
on two runs over the same tree?** If no, it belongs in the chain. If yes, it is a
measurement, and the chain is not where it gets a vote.

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
  repository has watched a glob match zero files and report success.

## 3. Prove it fails, twice

Once in the spec, once by hand:

```bash
# break it on purpose, then:
node scripts/check-<subject>.mjs   # must exit 1 and name the rule
git checkout -- <the file>
```

The spec pins the readers; the hand run pins the wiring — the file list, the
`git ls-files` filter, the resolution of a relative path. Both have been wrong
here: a facade pattern that matched every package except `core`, a bench list
that skipped untracked files, a `vi.mock` string no import-rewriter could see.

### A gate over `git ls-files` cannot see your new file

Every gate that lists files through git is blind to whatever is untracked, so a
green run before the first `git add` says nothing about the files you just wrote.

**`git add -A`, then run the chain.** Not a suggestion — it has been learned three
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
- A threshold is the *measured floor minus one*. Two runs of an unchanged suite
  differ in the hundredths, and a number nailed to the best observation fails on
  a coin toss — a gate that cries wolf stops being read.
- The comment above a threshold states the measurement, not a target.

## 6. What a gate must not do

- **Do not delegate to a sibling repository or a global install.** A gate runs on
  what this checkout contains.
- **Do not pass a path filter that can match nothing.** `vitest run <path>` with
  no match exits 0; so does `pnpm --filter <not-a-package-name>`. If a filter is
  unavoidable, assert the count.
- **Do not swallow a pipe.** `grep -q` and `head -n` close the pipe early, and the
  producer dies with 141 — which reads as a pass under `pipefail`.
- **Do not check style a formatter already owns.** Prettier and ESLint run first
  in the chain; a gate exists for the rules they cannot express.

## 7. The gates, and what each owns

| Gate | Canon | Answers |
| --- | --- | --- |
| `check:naming` | `skills/naming` | is it called what it is |
| `check:structure` | `skills/structure` | is it where its kind lives |
| `check:composition` | `skills/composition` | is the code inside it arranged |
| `check:docs` | `skills/documentation` | one language, and a deprecation that instructs |
| `check:api` | `skills/surface` | is the promise written down and demonstrated |
| `check:points` | `skills/surface` | does every extension point have an occupant |
| `check:twins` | `skills/surface` | do the two vendor packages stay one package twice |
| `check:forms` | `skills/forms` | is it a class, a factory, a frozen table or a function |
| `check:parity` | `skills/parity` | can both styles reach every role |
| `check:perf` | `skills/performance` | did a hot path get dearer |
| `check:drift` | — | does the generated output match the registry |
| `check:publishable` | — | would npm accept what this package claims |

Read the canon before changing the gate. A gate edited to accept the code is a
canon edited by accident, and the diff does not say so.
