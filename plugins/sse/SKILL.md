# Maintaining `@lankajs/plugin-sse`

One SSE transport behind `ILankaServerEventTransport`, and the names this package
has always published. The package knows no event type — which of them exist is
the application's domain.

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, always
  `workspace:^`.
- **Only `LankaSseTransport` is about `text/event-stream`.** The bridge, the
  "came from outside" marker and the plugin's own lifetime are
  [`lanka/stream`](../../core/src/stream/index.ts)'s, and are re-exported HERE
  under the names this package published first. They must not be forked back.
- It knows no concrete event and no scenario. Bridges arrive from the application
  as a factory, because a bridge needs the transport and the marker, and both
  belong to _this_ plugin installation.
- It re-exports `createLankaBurstCoalescer` and `createLankaLatestGuard` from its
  own surface for the realtime case; the implementations live in
  [`@lankajs/async`](../../modules/async/SKILL.md) and must not be forked here.

## Invariants

1. **Every published name is unchanged, and `api/plugin-sse.api.md` proves it.**
   `ALankaSseBridge` IS `ALankaStreamBridge`, `createLankaSseBridge` IS
   `createLankaStreamBridge`, and `ILankaSseTriggerContext` is an alias. A
   consumer's `class X extends ALankaSseBridge` keeps compiling, and so does one
   written against `lanka/stream` — because they are the same class.

2. **`lankaSse` delegates installation to `lankaStream`.** Bridge registration,
   `connectOnInstall` and the teardown ORDER — bridges detached before the stream
   closes — are one implementation shared with three other plugins, so the four
   cannot disagree about them.

3. **The bridges context is called `sse`, not `stream`.** That is the only
   difference between this plugin and `lankaStream`, and it is kept because the
   alternative is a rename across every consumer's bridge file for nothing.

4. **The plugin does not connect on install.** The stream is for an
   authenticated user, and when that happens is the application's knowledge.
   `connectOnInstall` exists and defaults to off; a default of on would open a
   connection on the sign-in screen.

5. **`onReconnect` never fires on the first connection.** Its meaning is "you
   missed something", and a first-connection call would make every screen refetch
   data it just loaded.

6. **A bare event body is accepted alongside the envelope.** Refusing it silently
   loses events for a backend that still sends the second form.

7. **One wire listener per event type per connection.** `EventSource` listeners
   outlive an unsubscribe — only closing the connection removes them — so a type
   dropped and taken up again used to get a second listener, and every handler
   for it then ran twice per event.

8. **`LankaSseTransport` does NOT extend `ALankaStreamTransport`, and that is a
   deliberate hold.** It predates the base and implements the same ladder against
   `EventSource`'s own `onopen` / `onerror`; rewriting a published connection is
   a change with its own risk and its own review, not a tidy-up to bundle with a
   feature. The base is where a FIFTH transport starts.

9. **`EventSource` is reached through `typeof`.** On an engine without it the
   plugin is simply off for the session: every screen keeps working because the
   same data arrives through route loaders. Some engines expose the constructor
   and refuse the connection — there the transport gives up quietly rather than
   entering a reconnect loop, because retrying what cannot succeed is a storm.

## Tests and coverage

Beside each unit, plus the `_playground/` scene: a room whose participants arrive
over the stream, with a reconnect in the middle. The bridge and the marker are
tested in core, where they now live.

Coverage is a ratchet: statements 99, branches 92, functions 99, lines 99. It
ROSE when the protocol-free half moved out — what is left is the connection and
the plugin that owns it, and both are driven end to end.

What to pin: the URL coming from the host, a missing engine breaking nothing,
reconnection not turning into a storm, one wire listener per type, and an
unparseable frame being dropped rather than thrown.

## Performance

`lankaSse.bench.ts`; baseline in `perf/sse.perf.md`, in yardsticks. The
interesting number is dispatch to N bridges, not connection setup.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-sse test
pnpm --filter @lankajs/plugin-sse test:coverage
node scripts/check-api.mjs           # the published names must not move
node scripts/check-publishable.mjs   # the peer range
pnpm check
```

## Traps

**Re-declaring the bridge, the marker or the port here.** They are `lanka/stream`'s.
Two copies of the marker are two chances to get it wrong once, and its failure is
silent.

**Renaming the `sse` field in the bridges context.** See invariant 3.

**Letting a bridge subscribe to the transport directly.** It loses the marker and
the disposal, which are the two things bridges exist for.

**Making the marker async-aware** with an async-context mechanism. It would be a
different guarantee with a different cost, and the current honesty — the marker
ends at the first `await` — is a documented boundary rather than a gap.

**Forking the coalescer or the guard.** They are re-exported from `@lankajs/async`
on purpose; two copies would drift.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
