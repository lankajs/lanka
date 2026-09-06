---
name: lanka-websocket
description: Wire a WebSocket into a lanka application — one channel, bridges from a server message to a scenario, the marker that says a change came from outside, and sending. Use when adding two-way realtime, when a screen must react to a server push AND answer it, when a proxy has taken SSE away, or when reviewing code that imports `@lankajs/plugin-websocket`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-websocket
    version: "2.0.0"
---

# @lankajs/plugin-websocket

One channel, your bridges, the "from outside" marker, and the half SSE does not
have. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Which package

| The wire                            | Reach for                    |
| ----------------------------------- | ---------------------------- |
| server pushes, client only reads    | `@lankajs/plugin-sse`        |
| both directions                     | this                         |
| GraphQL subscriptions               | `@lankajs/plugin-graphql`    |
| a gRPC server stream                | `@lankajs/plugin-grpc`       |

They share `lanka/stream`: the bridge, the marker and the plugin's lifetime are
the same four things every time, so switching is a line of configuration.

## Setup

```ts
const roomBridge = createLankaStreamBridge(({ on, onReconnect }) => {
	on("room.message", (payload) => messageArrived.trigger(payload as { text: string }));
	onReconnect(() => void roomVM.load()); // catch up on what was missed
});

const room = lankaWebSocket({
	path: "/ws/room",
	heartbeatMs: 20_000,
	bridges: ({ socket, trigger }) => [roomBridge(socket, trigger)],
	refreshAuth: () => session.refresh(),
	onSessionLost: () => session.signOut(),
});

lanka.use(room);
room.socket.connect(); // when the user is authenticated — NOT on install
```

`connectOnInstall` is off by default on purpose: the socket is for an
authenticated user, and a plugin that connected on registration would open a
handshake from the sign-in screen.

## Bridges are inbound only

A bridge is the one thing the package cannot write for you: which server messages
exist, and which of your scenarios each one means.

| Hook                      | For                              |
| ------------------------- | -------------------------------- |
| `on(type, handler)`       | a message with a payload         |
| `onSignal(type, handler)` | a message with none              |
| `onReconnect(handler)`    | catch-up after the link returned |

The class form (`ALankaStreamBridge`, implement `register()`) is for a bridge
with state of its own. Both are the same class.

**A bridge does not send.** One that both starts and finishes a conversation is
untestable without a socket, and becomes the object every screen reaches into.

Subscriptions are collected and released on `dispose()`, which the plugin calls
for you — before closing the socket.

**`onReconnect` is not `onConnect`.** It fires only after a reconnection: what
happened while the link was down was missed, so refetch.

## Sending

`plugin.socket` is an `ILankaWebSocketChannel`. Give it to whatever already owns
the action — a gateway, a ViewModel — through its constructor, so a test can
hand over a double:

```ts
class RoomGateway {
	private readonly channel: ILankaWebSocketChannel;
	public constructor(channel: ILankaWebSocketChannel) {
		this.channel = channel;
	}
	public say(text: string) {
		return this.channel.send("room.say", { text });
	}
}
```

`send` answers `true` if it went out now, `false` if it was **held** for the next
connection. Branch on it only when the message expires:

```ts
if (!room.socket.send("cursor.moved", position)) {
	// a cursor from thirty seconds ago is worse than none
}
```

## The outbox and the heartbeat

- Messages sent while the link is down are held (`queueWhileClosed`, default on)
  up to `maxQueuedMessages` (50), and the **oldest** is dropped. Turn it off where
  a late message is worse than none.
- `heartbeatMs` pings; silence for `heartbeatTimeoutMs` counts as a drop. **Off by
  default** — a heartbeat against a server that ignores pings closes a connection
  that works. Any inbound traffic answers it.

## The "from outside" marker

```ts
if (room.trigger.isActive()) {
	/* we are inside a server-message handler */
}
```

Without it a handler cannot tell its own change from someone else's: the user
sends a message and then receives the server's copy of it. The bridge sets it for
you. It is **synchronous** — read it before any `await`.

## The envelope

`{ type, payload }` and `{ type, ...fields }` both arrive as `on(type, …)`;
`trigger` is a second spelling of `type`. For a protocol somebody else designed,
replace `readFrame` and `writeFrame` whole. Returning `null` from `readFrame`
drops the frame.

## Never do these

- **Never subscribe to the channel directly** from a screen. You lose the marker
  and the disposal.
- **Never send from a bridge.**
- **Never read `isActive()` after an `await`.** Read it first, keep the boolean.
- **Never connect on install.**
- **Never treat `onReconnect` as "connected".** It means "you missed something".
- **Never switch the heartbeat on** without knowing the server answers pings.

## Symptom → cause

| What you see                              | What it is                                          |
| ----------------------------------------- | --------------------------------------------------- |
| a toast about the user's own message      | the marker was not set — subscribed directly        |
| the screen is stale and nothing errored   | a half-open socket; switch the heartbeat on         |
| a message vanished during a reconnect     | `queueWhileClosed: false`, or the outbox overflowed |
| every message arrives twice               | two connections — `connect()` called on each render |
| a connection open on the sign-in screen   | `connectOnInstall: true`                            |
| nothing arrives and no frame is refused   | the backend's envelope is not the default one       |

## More

`reference.md` — the full guide, including bringing your own channel and swapping
the wire under an application that started on SSE.
