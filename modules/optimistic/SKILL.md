# Maintaining `@lankajs/optimistic`

One class, `LankaOptimisticActions`, and its factory twin. It owns two
concurrency strategies over keyed mutations and nothing else: no state, no
gateway, no knowledge of what is being mutated.

## Boundary

- A **module**: the application calls it. Core does not know it exists.
- It imports `lanka/errors` and nothing else from this repository.
- It never touches state itself. The caller applies, the caller rolls back; this
  package decides _whether_ and _when_ those run.

## Invariants

1. **Two strategies, separated by what counts as a failure — not by
   convenience.** `runLatest` supersedes, and a superseded call runs neither
   success nor rollback, because a newer intent has already replaced the state it
   would restore. `runExclusive` locks, and rolls back on _any_ failure including
   cancellation and timeout, because there is no superseding click to justify
   skipping it. Do not unify them.

2. **`runExclusive` returns three outcomes, never a boolean.** `"blocked"` and
   `"failed"` must be handled in opposite ways — silence versus a message — and a
   boolean cannot tell them apart. Adding a fourth outcome means adding a fourth
   thing a screen must render.

3. **The exclusive lock expires.** `DEFAULT_EXCLUSIVE_TIMEOUT_MS` is 15 s. Without
   a deadline, one missing server response freezes an item until a reload. The
   deadline aborts the request _and_ rolls back.

4. **Both strategies hand an `AbortSignal` to the request callback.** That is the
   feature: a superseded request stops consuming a connection. A change that
   makes the signal optional makes the package a bookkeeping helper.

5. **`runLatest` checks identity, not a counter.** `isStillLatest()` compares the
   controller it created against the one currently registered for the key. A
   counter would be equivalent until two calls land in the same tick.

6. **Cancellation is not an error as far as the screen is concerned.** An abort
   in `runLatest` returns silently. If that ever becomes a visible failure, every
   fast double-press shows an error the user caused by using the app correctly.

## Tests and coverage

Beside the class, plus the `_playground/` editor scene that drives both
strategies through a real sequence of presses.

Coverage is a ratchet: statements 99, branches 96, functions 99, lines 99. These
are high because the package is small and every path matters — add the test, do
not lower the number.

Test the paths that regressed elsewhere: a superseded call must not roll back, a
blocked call must not apply, and a timeout must roll back.

## Performance

`LankaOptimisticActions.bench.ts`; baseline in `perf/optimistic.perf.md`, in
yardsticks. Follow the three-run protocol in
[`../../skills/performance/SKILL.md`](../../skills/performance/SKILL.md).

## Before you finish

```bash
pnpm --filter @lankajs/optimistic test
pnpm --filter @lankajs/optimistic test:coverage
node scripts/check-parity.mjs
pnpm check
```

## Traps

**Making the factory do more than the class.** It is one line, and that is the
point: the factory _is_ the class, so a behaviour cannot exist in one style and
not the other.

**Adding a "retry" option.** Retry is request policy and belongs to
`@lankajs/plugin-http`, where it can see the response. Here it would run the
optimistic apply twice.

**Clearing the key map outside `finally`.** A leftover lock is a permanently dead
button, and it looks like a UI bug rather than a bookkeeping one.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
