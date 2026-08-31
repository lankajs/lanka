# Maintaining `@lankajs/plugin-sse`

One SSE transport behind a port, an abstract bridge with both styles, and the
"came from outside" marker. The package knows no event type — which of them exist
is the application's domain.

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, always
  `workspace:^`.
- It knows no concrete event and no scenario. Bridges arrive from the application
  as a factory, because a bridge needs the transport and the marker, and both
  belong to _this_ plugin installation.
- It re-exports `createLankaBurstCoalescer` and `createLankaLatestGuard` from its
  own surface for the realtime case; the implementations live in
  [`@lankajs/async`](../../modules/async/SKILL.md) and must not be forked here.

## Invariants

1. **The plugin does not connect on install.** The stream is for an
   authenticated user, and when that happens is the application's knowledge.
   `connectOnInstall` exists and defaults to off; a default of on would open a
   connection on the sign-in screen.

2. **Bridges collect their subscriptions and release them on `dispose()`.** A
   bridge that never unsubscribes cannot notice the problem while it lives as
   long as the application — but a plugin is removed, an instance is disposed, a
   dev server reloads the module, and a leftover subscription keeps triggering a
   dead instance's scenarios.

3. **Teardown detaches bridges BEFORE closing the stream.** The other order
   leaves them a chance to receive one last event from a dead connection.

4. **The marker is set in `ALankaSseBridge.on`, not by each bridge.** A handler
   that forgot it is indistinguishable from a user action, and the failure is
   silent: the screen behaves oddly in a rare case.

5. **The marker is an instance, not a module variable.** A module-level flag is
   one per process; two framework instances would share it and one instance's
   handler would see a marker set by the other.

6. **The marker is synchronous and restores the previous value in `finally`.**
   Resetting to `false` would let a nested call clear the outer marker, and the
   rest of the outer handler would consider itself a user action. It deliberately
   does not survive an `await`: after one, control has been anywhere.

7. **`onReconnect` never fires on the first connection.** Its meaning is "you
   missed something", and a first-connection call would make every screen refetch
   data it just loaded.

8. **A bare event body is accepted alongside the envelope.** Refusing it silently
   loses events for a backend that still sends the second form.

9. **The transport is a port with one implementation.** That is a seam, not
   speculation: a proxy stripping `text/event-stream` leaves an application with
   a WebSocket. A _second_ implementation nobody asked for would be an imagined
   need costing real support — it arrives with its first consumer.

10. **`ALankaSseBridge`'s constructor is public** even though the class is
    abstract. `protected` is inherited, and the application's subclass would then
    be unreachable to the code that creates it. Fields are declared explicitly
    because `erasableSyntaxOnly` forbids parameter properties.

## Tests and coverage

Beside each unit, plus the `_playground/` scene: a room whose participants arrive
over the stream, with a reconnect in the middle.

Coverage is a ratchet: statements 93, branches 88, functions 91, lines 93.

What to pin: disposal removing every subscription, the marker restored after a
nested `run`, the marker absent after an `await`, teardown order, and an
unparseable frame being dropped rather than thrown.

## Performance

`lankaSse.bench.ts`; baseline in `perf/sse.perf.md`, in yardsticks. The
interesting number is dispatch to N bridges, not connection setup.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-sse test
pnpm --filter @lankajs/plugin-sse test:coverage
node scripts/check-parity.mjs        # bridge: class and factory
node scripts/check-publishable.mjs   # the peer range
pnpm check
```

## Traps

**Adding a second transport implementation "for completeness".** See invariant 9.

**Letting a bridge subscribe to the transport directly.** It loses the marker and
the disposal, which are the two things the base class exists for.

**Making the marker async-aware** with an async-context mechanism. It would be a
different guarantee with a different cost, and the current honesty — the marker
ends at the first `await` — is a documented boundary rather than a gap.

**Forking the coalescer or the guard.** They are re-exported from `@lankajs/async`
on purpose; two copies would drift.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
