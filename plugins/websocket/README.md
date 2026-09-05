# @lankajs/plugin-websocket

**⬡ plugin** · A two-way channel as a source of change

> A WebSocket behind the same port SSE uses, plus the half SSE does not have: sending.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
use(plugin) · host.apiBaseUrl
```

## Contents

- `LankaWebSocketTransport` — connection, heartbeat, outbox, reconnection with growing backoff
- `ILankaWebSocketChannel` — the port: the event transport, plus `send`
- `lankaWebSocket` — the plugin: bridges attached, lifetime owned, marker set

## The same port, so the choice is not permanent

`LankaWebSocketTransport` implements `ILankaServerEventTransport` from `lanka/stream`,
which is what `@lankajs/plugin-sse` takes as its `transport`. An application that
started on SSE and hit a proxy stripping `text/event-stream` changes one line of
configuration; every bridge, scenario and screen above it is untouched. That is the
promise the port was written for, and this package is the first thing to keep it.

## Sending is not a bridge's job

A bridge is inbound only, on a two-way wire as much as on a one-way one. A bridge that
also sends is the one object that both starts and finishes a conversation: untestable
without a socket, and the place every screen eventually reaches into. `plugin.socket` is
the channel, and it goes to whatever already owns the action — a gateway, a ViewModel.

## What the outbox is for, and what it is not

A message sent while the link is down is held and flushed when it opens, because a
reconnect is invisible from a screen and losing the click that happened during one is
not a behaviour anybody chose. The buffer is BOUNDED and drops its oldest entry: an
unbounded outbox on a connection that never comes back is a memory leak that looks like
patience. `queueWhileClosed: false` turns it off for a wire where a late message is
worse than none.

## A dead socket does not report itself

A half-open connection — the peer gone, the socket still `OPEN` — is the failure a
WebSocket has and SSE does not. `heartbeatMs` sends a ping and expects an answer inside
`heartbeatTimeoutMs`; silence is treated as a drop and enters the same reconnect ladder.
Off by default: a heartbeat against a server that does not answer pings would close a
connection that works.

## The envelope is a seam, not a format

A WebSocket has no per-event channel, so the event type is read out of the frame:
`{ type, payload }` and `{ type, ...fields }` are both understood. `readFrame` and
`writeFrame` replace that wholesale for a backend whose protocol was decided before
this package existed.

---

Repository map: [../../README.md](../../README.md)
