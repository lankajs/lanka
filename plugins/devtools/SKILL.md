# Maintaining `@lankajs/plugin-devtools`

An inspector over the bus, the logger, the wire and the scenario register, with a
DOM panel. The package's defining property is what it does when it is **off**.

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, `workspace:^`.
- It reads; it never participates. No middleware decision, no request it can
  change, no state, no behaviour a consumer could come to depend on.
- It has no view-library dependency and must not acquire one. The panel is the
  only rendering in the package.

## Invariants

1. **A disabled inspector accumulates nothing.** No collector is constructed, no
   subscription is made, no global is exposed, and the snapshot is a shared empty
   object — so a bundler removes the plugin and everything behind it. This has
   its own test and it is the reason the package is safe to install.

2. **`renderLankaDevtoolsPanel` returns `undefined` before doing any work**
   outside development. A panel in a production build is not extra bytes, it is
   an interface that can appear on a user's screen.

3. **Nothing it attaches to may change what it watches.** Three places now, and
   the rule is the same in all three: the bus middleware returns `"pass"`
   unconditionally, the bus observer's return value is ignored, and the request
   wrapper rethrows what it caught. Anything able to decide would turn a
   diagnostic tool into a participant, and "I disabled the inspector and it
   started working" would become a possible sentence.

4. **The collector has its own source.** Reading the bus's replay buffer would
   make the inspector depend on a leak — up to a hundred payloads per event type
   for the whole session. Collecting "just in case" is that defect under another
   name. No payload is kept at all: what an event carried belongs in the
   application's own log line.

5. **Everything collected is bounded.** `LankaRingBuffer` with explicit limits on
   events, logs and requests: an inspector accumulating without one is a leak
   with a user interface, visible only in a long session.

6. **Teardown removes the sink, the observer, the request middleware, the global
   and the contents.** A logger sink left behind holds the collector, which holds
   every line it ever saw; a global left behind holds all of it in a build that
   was supposed to drop the plugin.

7. **The clock is injected.** Timestamps are asserted in tests, and a real clock
   makes those assertions flaky.

8. **A dispatch is recorded when it STARTS and completed when the bus says how it
   ended.** Two sources for one row, and the reason is order: a subscriber that
   dispatches another event nests, so the inner dispatch finishes first. Rows
   read in the order things HAPPENED; an inspector whose list reordered itself as
   events completed would answer a question nobody asked.

   The outcome is matched to the LAST unfinished row of that event type, and an
   outcome with no row at all is recorded as a row of its own — that case means a
   middleware ahead of the inspector's stopped the event, which is itself worth
   showing.

9. **`stoppedBy` comes from the observer and from nowhere else.** A middleware
   sees only the chain ahead of itself and the inspector's is registered first.
   Before the observer existed, the field was in the type, in the snapshot and in
   the guide, and no code path could fill it — the failure a documented promise
   makes when nothing executes it.

10. **Notifications are coalesced.** The collector folds a turn's worth of
    changes into one microtask; the panel folds those into one animation frame. A
    panel that redrew per event would make reading the inspector the reason the
    application is slow.

## The panel rule, and why it was reversed

This file used to say the panel was deliberately thirty lines and that letting it
grow was a trap; a real inspector UI belonged in the consumer's own debug screen,
fed by `getSnapshot()`.

**What that rule was guarding against**: a package acquiring a view-library
dependency, and a debug surface turning into a product one.

**What it actually produced**: a panel nobody opened. The logs, the requests and
the scenario register were reachable only by writing a debug screen of your own,
which is a project nobody starts while debugging — so the data the package exists
to surface stayed unread, which is the defect the package exists to fix.

**What replaces it.** Invariants 1, 2 and 3 above still hold and are what the
guard was really about. Plus one new bound: the panel is a playground-driven
surface like any other — every control it grows is driven by a scene, and its
parts stay inside the composition budget, which is what stops "a filter box" from
becoming "a tab strip with a settings menu".

If the panel ever needs a view library, the answer is still no. That is the line,
and it has not moved.

## Tests and coverage

Beside each unit, plus the `_playground/` scenes.

Coverage is a ratchet: statements 99, branches 91, functions 99, lines 99.

The test that matters most is still the **absence** one: with the inspector
disabled, nothing is subscribed and the collector module's work is never
performed. Assert it by counting subscriptions on the bus and the logger, not by
reading the snapshot.

Also worth pinning: the ring buffer dropping the oldest at the limit, `stoppedBy`
arriving from a middleware registered AFTER the inspector's, a nested dispatch
being matched to the right row, a scenario that has never fired appearing in the
register, teardown leaving the logger with no sinks and `globalThis` without the
exposed name.

What the panel says is tested apart from how it looks: `lankaDevtoolsPanelRows`
takes a snapshot and answers lines, and a test that had to mount a document to
read them would assert on element trees and then break on every change to the
styling it was never about.

## Performance

`LankaRingBuffer.bench.ts`; baseline in `perf/devtools.perf.md`, in yardsticks.
The buffer is a plain array with a `shift` at the bound, and it stays that way:
the rewrite to a real ring was measured and reverted, because nothing needed it.

The cost this package can put on an application that never opens it lives in
CORE, not here: `LankaEventBusInstance.bench.ts` measures a dispatch with and
without an observer, and the unobserved case is what every application pays.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-devtools test
pnpm --filter @lankajs/plugin-devtools test:coverage
pnpm check
```

## Traps

**Adding a "just log it anyway" path.** Every one of them turns invariant 1 into
a false statement, and the cost lands on users who never open a devtool.

**Reading the bus's buffer for "richer" data.** See invariant 4.

**Making the middleware conditional on something.** It returns `"pass"`,
unconditionally, forever. So does the observer's silence, and the request
wrapper's rethrow.

**Giving the panel a view library.** See "the panel rule" above: that line has
not moved, and it is the one thing the old rule was actually protecting.

**Recording a payload.** Invariant 4. The moment the inspector holds one, it is
the leak it was written against, and in an application whose data arrives over
the wire that is personal data kept in memory with no consumer.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
