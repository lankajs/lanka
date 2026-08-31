# Maintaining `@lankajs/plugin-bootstrap-steps`

A start-up chain with a context, an early exit and a redirect target. Small, and
its whole justification is one distinction: core runs a **set**, this runs a
**chain**.

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, `workspace:^`.
- It owns the pipeline's lifetime and nothing else. What the steps do, what the
  context holds and where a redirect goes are all the application's.
- It must not grow into a router, a session manager or a service registry. Each
  of those is a step somebody writes.

## Invariants

1. **This does not duplicate core's bootstrap; it answers a different shape.**
   Core's services have a name, a priority, a sync flag, `optional` and a
   deadline, and do not talk to each other. Here a step reads what the previous
   one produced and may stop the chain. If a change would make the two
   interchangeable, one of them should be deleted rather than both kept.

2. **`optional` and `timeoutMs` keep core's words and core's meaning.** The
   executor differs; the questions the configuration answers do not. Renaming
   them would force a reader to remember which of the two they are in.

3. **A failed optional step returns the context UNTOUCHED.** A step that failed
   midway may have written half its result, and continuing with that half is
   worse than continuing without it.

4. **An early exit is a value, not an exception.** `{ done: true, redirectTo }`
   is a decision; a throw is a failure. Only the first can carry a destination.

5. **Only a completed run is remembered.** An early exit means "the user is not
   signed in"; remembering it strands the app on the sign-in screen forever.

6. **Concurrent `run()` calls share one in-flight run**, and the in-flight
   handle is cleared in `finally`.

7. **`createContext` is a function.** A repeat run must start clean; a shared
   object would carry the previous run's half-written fields.

8. **Disposing the instance resets the pipeline.** Otherwise the next instance —
   a test beside the app, a dev module reload — considers bootstrap done.

9. **`toConfig()` is the one place the two styles meet.** The pipeline receives a
   config either way and cannot tell which style wrote a step.

## Tests and coverage

Beside each unit, plus the `_playground/` scene: restore, require sign-in,
optional analytics, with a failing step and a timing-out step.

Coverage is a ratchet: statements 99, branches 95, functions 99, lines 99.

What to pin: an optional failure leaving the context byte-identical, an early
exit not being remembered, a completed run being remembered, two concurrent
`run()` calls producing one execution, and a class step and a config step
behaving identically.

## Performance

`createLankaBootstrapPipeline.bench.ts`; baseline in
`perf/bootstrap-steps.perf.md`, in yardsticks. What is measured is the pipeline's
own overhead per step — the steps themselves belong to the application.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-bootstrap-steps test
pnpm --filter @lankajs/plugin-bootstrap-steps test:coverage
node scripts/check-parity.mjs
pnpm check
```

## Traps

**Adding a "retry this step" option.** A step that wants retrying can retry
inside itself, where it knows what is safe to repeat.

**Letting a step mutate the context.** Invariant 3 stops working the moment one
does, and the failure is invisible: the app simply starts with a field it should
not have.

**Remembering an early exit "for performance".** See invariant 5. It has been the
bug once already.

**Duplicating core's service options here with different names.** See invariant 2.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
