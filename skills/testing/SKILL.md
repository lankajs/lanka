# Testing

Three kinds of test live here, and each answers a question the others cannot.

| Kind       | Where                                  | Answers                                              |
| ---------- | -------------------------------------- | ---------------------------------------------------- |
| unit       | `X.test.ts` beside `X.ts`              | does this unit behave                                |
| playground | `<pkg>/_playground/playground.test.ts` | do the parts still FIT, through the public path      |
| gate spec  | `scripts/check-*.test.mjs`             | does the guard still fail on what it exists to catch |

A bench (`X.bench.ts`) is not a test: it reports a number and asserts nothing.
What it is for, and why it may not live in a test file, is
`skills/performance/SKILL.md`.

## 1. A test asserts, or it is not a test

Forty-five blocks in this repository were named `stress`, ran a thousand
iterations, printed a duration and passed unconditionally. Fourteen measured only
that and were deleted; the rest assert something under load and stayed.

The rule that came out of it: **if the body cannot fail, it is not a test** —
whatever it prints, and however long it takes on every run.

## 2. What to assert

Pin the INVARIANT, not the implementation. The question to ask is "what would an
optimisation quietly break", and the answers here have been:

- **identity, not equality** — the collection view must answer the SAME array when
  nothing changed, because a new array is a new prop for every row below it;
- **counts** — a subscriber that unsubscribes itself mid-dispatch must not silence
  the next one; N callers of the coalescer must produce one call downstream;
- **round trips** — a thousand ids must decode back to exactly what went in;
- **absence** — after a reset, no subscription is left alive; with mocks off, the
  mock module is not even imported.

A test that restates the body in `expect` form protects nothing. A test named
after the defect it prevents survives the rewrite of the thing it tests.

## 3. Every package has a playground

`_playground/` is a miniature application: the package used the way a consumer
uses it, through the published path, with the outside world stubbed at exactly
one seam — the transport, the event source, the storage adapter.

- Units all green while the package is broken is what a refactor produces. The
  playground is what catches it.
- A published name with no scene is a promise made blind: `check-api` fails on it,
  and the way out is a scene, not an exemption.
- When a regression is reported, reproduce it in the playground FIRST. A failure
  that needs the whole chain has no single unit to live in.
- The playground is also the parity evidence: a role built both ways in one scene,
  asserting the same result, is what makes "both styles" a test rather than a
  claim (`skills/parity/SKILL.md` §6).

## 4. Coverage is a ratchet, and `pnpm check` runs it

`pnpm check` runs `test:coverage`, never bare `test` — a threshold nothing turns
is a number in a file. Each package's `vitest.config.ts` carries its own
thresholds with the measurement they came from written above them.

**Add the missing test; never lower a threshold.** The one legitimate edit is
downward-toward-strict after a measurement, and upward only when new tests raised
the floor for good.

Excluded from coverage, each for a stated reason in the config: declaration-only
folders (`_types/`, `_interfaces/`), benches (this run does not perform them), and
a helper that only `vitest bench` executes. Anything excluded without a reason is
a number that means nothing.

## 5. Mocking

- **Mock the seam, not the unit.** The transport, the crypto, the DOM API. A test
  that mocks the thing it is testing asserts that a stub was called.
- **`vi.mock` takes a STRING.** No refactor tool follows it: every folder move in
  this repository has broken a mock path, and the failure looks like a broken
  test rather than a broken import. After moving anything, run the package's suite
  before believing the move.
- **A double returns what the real thing returns.** The scenario double hands back
  a real unsubscribe, or the test "the ViewModel unsubscribes" proves only that a
  function was called.
- Prefer `@lankajs/tool-testing` over a local copy: `lankaTestHost`, `resetLanka`,
  `renderWithLanka`, `createLankaFakeTransport`. Two truths about what stands in
  for a host is one too many.

## 6. Isolation

`resetLanka()` creates a NEW framework instance and DISPOSES the previous one.
Both halves matter: cleaning leaves whatever nobody remembered to clean, and an
instance dropped without disposal keeps ViewModel subscriptions alive — they are
declared at module level and outlive any single test.

A test that inherits a neighbour's subscriptions passes or fails depending on the
order it ran in, which is the worst kind of red: it appears where nothing is
broken.

## 7. Where a test file lives

Beside its unit, in the unit's own folder — `skills/structure/SKILL.md` rules 3
and 8, enforced by `check-structure`. A directory holding tests for two units, or
a test with no sibling of its name, fails.

A test that speaks for several units has no single owner and stays at the level it
speaks for; those are listed in `CROSS_CUTTING` in the gate, with a reason each.

## 8. Size

A spec over 300 lines is two subjects sharing a file. Split by CONCERN —
`X.errors.test.ts`, `X.lifecycle.test.ts` — not by "part 1 / part 2". The
composition canon's budgets apply to test bodies too; `describe` blocks do not
count, because a list of cases is not a function.

## 9. A peer's other majors are run, not read

A peer range is widened only to majors that RAN (`skills/surface/SKILL.md` §5 makes
the widening a minor and the retraction a major, so a guess costs a major).
`_playgrounds/versions/<peer>-<major>` is where one runs: a small application
installing that major, running the package's scenes from `versions/_shared`.

Three rules make such a run honest:

1. **The first scene asserts the major it got** — `VERSION.major` for Angular, the
   running Vitest's own version. The package under test is workspace source with
   its OWN copy of the peer beside it, and a run that quietly resolved that copy
   would pass every scene against the wrong major.
2. **Resolve the peer from the application, and prove that the mechanism
   carries weight.** For a framework the application needs `resolve.dedupe` on
   every package of it — plus `server.deps.inline` for a library node would
   otherwise load past the dedupe, as Angular Testing Library is. Removing the
   dedupe fails the Angular runs. Vitest needs none: it answers every `vitest`
   import in a run with itself, and removing a dedupe there changed nothing —
   so there is none, since a setting that carries no weight misleads the next
   reader into thinking it does.
3. **The major stays in its playground.** Installing Vitest 5 anywhere put it in
   the lockfile, and pnpm resolves a DEPENDENCY's optional peer from the importer,
   not the workspace root: `@lankajs/svelte` never named vitest, relied on the
   root's 3, and was handed 5 through `@testing-library/svelte` — its suite ran
   under a runner nobody chose, and failed only because the coverage provider was
   still 3. An importer whose dependency has a peer on a versioned package names
   the repository's major itself; `check-playgrounds` `[version-leak]` refuses
   a lockfile where any importer outside `_playgrounds/versions/` resolves
   another.
