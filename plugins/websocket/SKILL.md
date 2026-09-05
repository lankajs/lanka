# Maintaining `@lankajs/plugin-websocket`

One WebSocket behind `ILankaServerEventTransport`, plus the half a server-sent
stream does not have: sending. The package knows no message type — which of them
exist is the application's domain.

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, always
  `workspace:^`.
- The bridge, the "from outside" marker and the plugin's own lifetime are
  [`lanka/stream`](../../core/src/stream/index.ts)'s. They are re-exported from
  this barrel for one-import convenience and must NOT be forked here.
- It knows no concrete message and no scenario. Bridges arrive from the
  application as a factory, because a bridge needs the channel and the marker,
  and both belong to _this_ plugin installation.
- It must not depend on `@lankajs/plugin-sse` or any other plugin. What two
  plugins share is in core, which is why the port is.

## Invariants

1. **`LankaWebSocketTransport` implements `ILankaServerEventTransport`, and that
   is a promise.** It is the type `lankaSse` takes as its `transport`, and the
   whole claim of the port is that a proxy stripping `text/event-stream` costs an
   application one line of configuration. A member added here that the port does
   not have must go on `ILankaWebSocketChannel`, never on the port.

2. **`ILankaWebSocketChannel` is a second port, not a widened first one.** The
   event transport is implemented by consumers; a member added to it is a compile
   error in every SSE transport anybody wrote (`skills/surface/SKILL.md` §6b).

3. **A bridge is inbound only.** A bridge that also sends is the one object that
   both starts and finishes a conversation: untestable without a socket, and the
   place every screen eventually reaches into. Sending is `plugin.socket`, handed
   to whatever already owns the action.

4. **The plugin does not connect on install.** The socket is for an authenticated
   user, and when that happens is the application's knowledge.

5. **The outbox is BOUNDED and drops its oldest entry.** An unbounded one on a
   link that never comes back is a memory leak that looks like patience. The
   oldest goes because on a link that has been down a while, the newest messages
   are the ones still worth sending.

6. **`send` answers whether it went out NOW.** A caller whose message expires
   branches on it. It is not a rejection, because most callers do not care and a
   rejection nobody handles is an unhandled one.

7. **The heartbeat is off by default.** One against a server that ignores pings
   would close a connection that works. Any inbound traffic answers it — the
   question is whether the peer is there, not whether it is polite.

8. **A loss is reported once.** `error` and `close` both fire on a dropped
   socket, and two losses spend two rungs of the backoff for one failure.

9. **`close()` detaches the handlers before closing.** `close()` fires `onclose`,
   and a loss reported from inside an explicit disconnect would reconnect the
   socket the application just gave up.

10. **The scheme is rewritten only for `http` and `https`.** Anything else — a
    bare path, an address already given as `ws://` — is left as written.
    Rewriting a scheme the package does not recognise is guessing at somebody's
    deployment.

11. **`WebSocket` is reached through `typeof`.** An engine without it gets the
    plugin switched off for the session, not a `ReferenceError` from inside the
    framework — and the package keeps its three declared environments
    (`skills/hosts/SKILL.md` §2).

## Tests and coverage

Beside each unit, plus the `_playground/` scene: a chat room that receives AND
sends, with a reconnect and a bounded outbox in the middle, and a channel the
application wrote itself over something that is not a `WebSocket`.

Coverage is a ratchet: statements 99, branches 94, functions 99, lines 99.

What to pin: a message held during a reconnect and flushed exactly once, the
oldest dropped when the outbox is full, a half-open socket becoming a reconnect,
one loss from two events, and an explicit disconnect not looking like a drop.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-websocket test
pnpm --filter @lankajs/plugin-websocket test:coverage
node scripts/check-parity.mjs        # the stream bridge: class and factory
node scripts/check-publishable.mjs   # the peer range
pnpm check
```

## Traps

**Adding `send` to `ILankaServerEventTransport`.** See invariant 2. It breaks
every consumer's transport, and the SSE one cannot implement it.

**Letting a bridge hold the channel.** See invariant 3.

**Turning the heartbeat on by default.** It closes working connections against
every backend that does not answer pings.

**Copying the bridge or the marker out of `lanka/stream`.** Two copies of the
marker are two chances to get it wrong once, and its failure is silent.

**Flushing the outbox from `connect()` rather than from `onopen`.** The socket is
not open yet, and `send` on a `CONNECTING` socket throws.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
