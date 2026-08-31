# Maintaining `@lankajs/async`

Four independent primitives — a latest-guard, a burst coalescer, polling, and a
fire-and-forget helper — for the concurrency problems a realtime screen has.
Nothing here holds application state, and nothing here knows what it is fetching.

## Boundary

- A **module**: the application calls it, core does not know it exists. Removing
  the package must leave core working exactly as before.
- It may import `lanka` (it uses `lanka/logger`, `lanka/internal` and the flags)
  and nothing else from this repository. No module imports another module.
- Nothing here may reach the network, hold a gateway, or know an endpoint. It is
  handed an operation and runs it.

## Invariants

1. **The guard and the coalescer solve different problems and must stay
   separate.** The guard makes a burst _correct_ (which answer may write); the
   coalescer makes it _cheap_ (how many requests). Merging them would produce a
   thing that is wrong in the cases where you need only one.

2. **A burst produces leading plus trailing, never plain deduplication.** If
   every event arrives while the first request is in flight, dropping duplicates
   leaves the screen showing a read taken _before_ the last change. The trailing
   request is the correctness half of a cost optimisation — do not remove it to
   save a round trip.

3. **The coalescer's bookkeeping is cleared in `finally`, and the trailing flag
   is cleared on failure.** Both are defects that were shipped once: a leftover
   in-flight record swallows every later refresh for that key (one network
   failure, a permanently stale screen), and a leftover trailing flag makes the
   _next_ unrelated call issue an extra request nobody asked for.

4. **Polling arms the next timer only after the previous callback settles.** A
   naked `setInterval` over an async callback piles executions up behind a slow
   endpoint. `beginPollingLoop` is deliberately synchronous — it arms the first
   timer and returns; declaring it `async` hands the caller a promise that
   resolves before a single poll has run.

5. **A polling callback that throws is logged, and the loop continues.** One
   failed poll is not a reason to stop polling.

6. **`safeFireAndForget` is loud in development and silent in production.** A
   bare `void promise` swallows the rejection; a console line in production costs
   bundle size and tells the user nothing.

## Tests and coverage

Beside each unit, plus the playground scene in `_playground/`, which builds a
live participant list using all three primitives together — because that is how
they are used, and each on its own is already a unit test.

Coverage is a ratchet: statements 98, branches 89, functions 99, lines 98. Add
the missing test; never lower a threshold.

The timing-sensitive tests use fake timers. A test that sleeps for real is a test
that fails on a loaded CI machine.

## Performance

`createLankaBurstCoalescer.bench.ts`; baseline in `perf/async.perf.md`. Numbers
are yardsticks, never hertz. Run the three-run A/B protocol from
[`../../skills/performance/SKILL.md`](../../skills/performance/SKILL.md) before
believing a change, and record with `node scripts/check-perf.mjs --write`.

## Before you finish

```bash
pnpm --filter @lankajs/async test
pnpm --filter @lankajs/async test:coverage
node scripts/check-api.mjs
pnpm check
```

## Traps

**A new primitive that "also does" what an existing one does.** The reason there
are four small things here rather than one manager is that each is independently
useful and independently testable. A fifth is welcome; a merger is not.

**Adding an option to the guard.** It has three members and a single number of
state. Anything more is a different object.

**Testing the coalescer without a failing operation.** The failure paths carry
two of the invariants above, and they are the ones that regressed.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
