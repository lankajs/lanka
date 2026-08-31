# Maintaining `@lankajs/tool-testing`

The kit every other package's tests run on: instance reset, the render helper,
the host, two doubles, the setup file, the `.lanka_di` fixture and the bench
yardstick.

A mistake here does not fail one package. It changes what the whole repository's
tests mean.

## Boundary

- A **tool**: a dev dependency. Nothing here ships in an application bundle.
- It is the one package whose job is to serve the others, which is why the
  `.lanka_di` fixture lives here — any package importing `lanka` pulls in the
  scenario bootstrap, which reads `@lanka_di/Scenarios`.
- It provides doubles for what a subject depends on, never for the subject.

## Invariants

1. **`resetLanka` disposes the previous instance before releasing the pointer.**
   ViewModels are declared at module level and outlive any test; their
   subscriptions are removed by the `dispose()` of the instance whose registry
   holds them. Moving the pointer alone leaves the previous test's subscriptions
   alive, and the next test receives events the first subscribed to. The order is
   load-bearing: disposal goes through the active instance, so clearing the
   pointer early leaves it disposing into nothing.

2. **A NEW instance, never a cleaned one.** Cleaning leaves behind whatever
   nobody remembered to clean — the exact class of failure an instance removes.

3. **`renderWithLanka` builds a fresh instance per call**, not per file. A test
   inheriting foreign subscriptions goes red where nothing is broken.

4. **The setup file resolves everything LAZILY, inside the hook.** A setup file
   runs before the test file's hoisted `vi.mock` calls are registered, so
   anything it imports at top level is evaluated against the real dependencies
   and the test's mock never reaches it. Importing the `lanka/scenario` barrel at
   top level pulls the whole subsystem into every test's graph and breaks any
   test legitimately mocking the bus — silently, as "the spy was called 0 times".

5. **The fake scenario returns a real unsubscribe.** A stub would let a test
   "prove" a ViewModel unsubscribes by proving it called a function that does
   nothing.

6. **There is no ViewModel double**, and there must not be. The ViewModel is the
   subject; what it needs from outside arrives as parameters.

7. **The bench yardstick is registered per FILE.** Vitest gives each bench file
   its own worker, and a yardstick measured in another process is measured on
   another machine for every purpose that matters here.

8. **The yardstick must not be foldable.** The measured body reads a property
   through a binding the optimiser cannot prove unused. A constant the engine
   folds away turns the unit into nothing, and every ratio in `perf/` with it.

9. **The `.lanka_di` fixture is generated, not written.** `pnpm run
sync:di-fixture` derives it from `@lankajs/tool-di`'s stubs. A hand edit
   diverges from the contract the plugin scaffolds, and the tests then verify a
   contract no consumer has.

10. **The host is frozen and minimal.** A spec that is about the host builds its
    own stub; one that is not has no reason to declare one.

## Tests and coverage

`lankaTestToolkit.test.tsx` plus the `_playground/` scene.

Coverage is a ratchet: statements 92, branches 87, **functions 68**, lines 92.
The function figure is low for a stated reason — the bench helper is excluded,
because it only runs under `vitest bench`, which the coverage run does not
perform. Counted, it reports 0% and drags the number that gates real code. Do not
extend that exclusion to anything else.

## Before you finish

```bash
pnpm --filter @lankajs/tool-testing test
pnpm --filter @lankajs/tool-testing test:coverage
pnpm run sync:di-fixture
pnpm check      # the whole repository — this package changes what its tests mean
```

The full run is not optional here. A change to the reset order or the setup file
can leave every package green individually and wrong together.

## Traps

**Adding a helper that hides state between tests.** Every convenience of that
shape trades a few lines for a suite whose result depends on file order.

**Importing anything at the top of `setupTests.ts`.** See invariant 4; the
failure is a spy that was called zero times, three files away.

**Hand-editing the fixture** instead of running the sync. See invariant 9.

**Adding a second transport double.** The reason this one is in the kit is that
everyone wrote their own slightly differently — one returned a `Response`,
another parsed JSON, a third forgot headers — and they diverged silently.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
