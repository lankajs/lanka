# Maintaining `@lankajs/plugin-devtools`

An inspector over the bus, the logger and the in-flight counter, with a small DOM
panel. The package's defining property is what it does when it is **off**.

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, `workspace:^`.
- It reads; it never participates. No middleware decision, no state, no
  behaviour a consumer could come to depend on.
- It has no view-library dependency and must not acquire one. The panel is the
  only rendering in the package.

## Invariants

1. **A disabled inspector accumulates nothing.** No collector is constructed, no
   subscription is made, and the snapshot is a shared empty object — so a
   bundler removes the plugin and everything behind it. This has its own test and
   it is the reason the package is safe to install.

2. **`renderLankaDevtoolsPanel` returns `undefined` before doing any work**
   outside development. A panel in a production build is not extra bytes, it is
   an interface that can appear on a user's screen.

3. **The bus middleware always returns `"pass"`.** Middleware able to stop
   delivery would turn a diagnostic tool into a participant, and "I disabled the
   inspector and it started working" would become a possible sentence.

4. **The collector has its own source.** Reading the bus's replay buffer would
   make the inspector depend on a leak — up to a hundred payloads per event type
   for the whole session. Collecting "just in case" is that defect under another
   name.

5. **Everything collected is bounded.** `LankaRingBuffer` with explicit limits:
   an inspector accumulating without one is a leak with a user interface, visible
   only in a long session.

6. **Teardown removes the sink, the subscription and the contents.** A logger
   sink left behind holds the collector, which holds every line it ever saw.

7. **The clock is injected.** Timestamps are asserted in tests, and a real clock
   makes those assertions flaky.

## Tests and coverage

Beside each unit, plus the `_playground/` scene.

Coverage is a ratchet: statements 99, branches 91, functions 99, lines 99.

The test that matters most is the **absence** one: with the inspector disabled,
nothing is subscribed and the collector module's work is never performed. Assert
it by counting subscriptions on the bus and the logger, not by reading the
snapshot.

Also worth pinning: the ring buffer dropping the oldest at the limit, `stoppedBy`
appearing when a middleware stops an event, and teardown leaving the logger with
no sinks.

## Performance

`LankaRingBuffer.bench.ts`; baseline in `perf/devtools.perf.md`, in yardsticks.
The buffer is a plain array with a `shift` at the bound, and it stays that way:
the rewrite to a real ring was measured and reverted, because nothing needed it.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-devtools test
pnpm --filter @lankajs/plugin-devtools test:coverage
pnpm check
```

## Traps

**Adding a "just log it anyway" path.** Every one of them turns invariant 1 into
a false statement, and the cost lands on users who never open a devtool.

**Letting the panel grow.** It is deliberately thirty lines of DOM. A real
inspector UI belongs in a consumer's own debug screen, fed by `getSnapshot()`.

**Reading the bus's buffer for "richer" data.** See invariant 4.

**Making the middleware conditional on something.** It returns `"pass"`,
unconditionally, forever.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
