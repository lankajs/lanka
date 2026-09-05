<!-- Generated from plugins/websocket/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/plugin-websocket@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/plugin-websocket`.
>
> Complete code, compiled and run in CI: [plugins/websocket/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/plugins/websocket/_playground/playground.test.ts)

# @lankajs/plugin-websocket — user guide

A WebSocket as a source of change, and as a way to answer: one connection, your
bridges from a server message to an application scenario, the marker that tells
a handler "this came from outside", and the half a server-sent stream does not
have — sending.

## You will learn

- how a socket message becomes an application scenario
- why sending is not a bridge's job, and where it goes instead
- what happens to a message you send while the link is down
- when to switch the heartbeat on, and what it catches

## When to reach for this

Reach for it when the wire has to carry traffic **both** ways: a chat, a
collaborative document, a presence list, a live cursor. When the server only
pushes and the client only reads, `@lankajs/plugin-sse` is one connection with
half the failure modes — no heartbeat, no outbox, and reconnection handled by
the browser.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-websocket
```

`lanka` is a peer dependency: the plugin plugs into the _same_ core instance you
created.

## Quick start

```ts
import { lankaWebSocket, createLankaStreamBridge } from "@lankajs/plugin-websocket";

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

// when the user is authenticated:
room.socket.connect();

// and to answer:
room.socket.send("room.say", { text: "hello" });
```

## Why it does not connect by itself

`connectOnInstall` is **off by default**. The socket is opened for an
_authenticated_ user, and when that happens is your knowledge. A plugin that
connected on registration would open a handshake from the sign-in screen and
then retry a rejected upgrade.

## The address

`path` is joined to `host.apiBaseUrl` with the scheme upgraded — `https://…`
becomes `wss://…`. When the socket lives on its own host, give the whole thing:

```ts
lankaWebSocket({ url: "wss://sockets.example.com/room" });
```

Nothing is derived from the other: a rule for turning an API host into a socket
host would be a guess this package cannot check.

## Bridges

A bridge is the one thing the package cannot write for you: which server
messages exist, and which of your scenarios each one means.

**As a factory:**

```ts
const roomBridge = createLankaStreamBridge(({ on, onSignal, onReconnect }) => {
	on("room.message", (payload) => messageArrived.trigger(payload as { text: string }));
	onSignal("room.cleared", () => void roomVM.load());
	onReconnect(() => void roomVM.load());
});
```

**As a class**, when the bridge has state of its own:

```ts
class RoomBridge extends ALankaStreamBridge {
	public register(): void {
		this.on("room.message", (payload) => messageArrived.trigger(payload as { text: string }));
	}
}
```

Both are the same class — the factory returns an `ALankaStreamBridge` — so
nothing above can tell which style wrote one.

| Hook                      | For                              |
| ------------------------- | -------------------------------- |
| `on(type, handler)`       | a message with a payload         |
| `onSignal(type, handler)` | a message with none              |
| `onReconnect(handler)`    | catch-up after the link returned |

Subscriptions are collected and released on `dispose()`, which the plugin calls
for you — before closing the socket, so a dying connection cannot deliver one
last message into a disposed instance.

**`onReconnect` is not `onConnect`.** It fires only after a _re_-connection:
what happened while the link was down was missed, so refetch instead of assuming
you are current.

## Sending is not a bridge's job

A bridge is inbound only, on a two-way wire as much as on a one-way one. A
bridge that also sends is the one object that both starts and finishes a
conversation: untestable without a socket, and the place every screen eventually
reaches into.

`plugin.socket` is an `ILankaWebSocketChannel`, and it goes to whatever already
owns the action:

```ts
class RoomGateway {
	private readonly channel: ILankaWebSocketChannel;

	public constructor(channel: ILankaWebSocketChannel) {
		this.channel = channel;
	}

	public say(text: string): boolean {
		return this.channel.send("room.say", { text });
	}
}

const roomGateway = new RoomGateway(room.socket);
```

In a test the constructor takes a double, and nothing has to open a socket.

### What `send` answers

`true` means it went out now. `false` means the link was down and the message
was **held** for the next connection — or dropped, if you turned holding off.

A caller whose message expires branches on it; one that does not can ignore it.
That is why it is a boolean and not a rejection:

```ts
if (!room.socket.send("cursor.moved", position)) {
	// a cursor position from thirty seconds ago is worse than none
}
```

## The outbox

A message sent during a reconnect is held and flushed when the socket opens,
because a reconnect is invisible from a screen and losing the click that
happened during one is not a behaviour anybody chose.

| Option               | Default | What it does                                   |
| -------------------- | ------- | ---------------------------------------------- |
| `queueWhileClosed`   | `true`  | hold messages sent while the link is down      |
| `maxQueuedMessages`  | `50`    | how many, before the **oldest** is dropped     |

The bound is not decoration: an unbounded outbox on a link that never comes back
is a memory leak that looks like patience. The oldest goes first because on a
link that has been down a while, the newest messages are the ones still worth
sending.

Turn it off where a late message is worse than no message:

```ts
lankaWebSocket({ queueWhileClosed: false });
```

## The heartbeat

A half-open socket — the peer gone, the socket still `OPEN` — is the failure
this protocol has and a server-sent stream does not. Nothing arrives, nothing
errors, and the screen is quietly stale forever.

```ts
lankaWebSocket({ heartbeatMs: 20_000, heartbeatTimeoutMs: 5_000 });
```

Every `heartbeatMs` a `ping` goes out; if **nothing at all** comes back inside
`heartbeatTimeoutMs`, the link counts as dropped and enters the same reconnect
ladder as a real close. Any traffic answers it — the question is whether the
peer is there, not whether it is polite.

**Off by default**, and deliberately: a heartbeat against a server that ignores
pings would close a connection that works. Switch it on when you know the
backend answers, and set `heartbeatEventType` if it calls the message something
else.

## Reconnection

Growing backoff, doubling from `reconnectDelayMs` (1s) to `maxReconnectDelayMs`
(30s), for `maxReconnectAttempts` (10) tries. When those are spent, `refreshAuth`
gets one chance to say the session is usable again; if it cannot,
`onSessionLost` is called and the transport stops.

The attempt count resets only on a connection that actually **opened** — not on
one that was attempted. That is the difference between a ceiling and a ceiling
that can never fire.

An explicit `disconnect()` outranks everything scheduled, including a refresh
already in flight.

## The frame envelope

There is no per-event channel on a socket, so the event type is read out of the
frame. Both of these arrive as `on("room.message", …)`:

```json
{ "type": "room.message", "payload": { "text": "hello" } }
{ "type": "room.message", "text": "hello" }
```

`trigger` is accepted as a second spelling of `type`.

When the protocol was decided before this package existed, replace the reader
and the writer whole:

```ts
lankaWebSocket({
	readFrame: (raw) => {
		const [name, body] = raw.split("|");
		return { type: name, payload: JSON.parse(body) as Record<string, unknown> };
	},
	writeFrame: (type, payload) => `${type}|${JSON.stringify(payload)}`,
});
```

Returning `null` from `readFrame` drops the frame silently, which is what you
want for a keep-alive the backend sends and nothing subscribes to.

## The "from outside" marker

```ts
if (room.trigger.isActive()) {
	/* we are inside a server-message handler */
}
```

Without it a handler cannot tell its own change from someone else's: the user
sends a message and then receives the server's copy of it. The screen notifies
the user about their own action, and an optimistic update is rolled back by a
"foreign" message that in fact confirms it.

The bridge sets it for you. It is **synchronous** — read it before any `await`;
after one, control has been anywhere and the marker is honestly gone.

## Bringing your own channel

`ILankaWebSocketChannel` is the event transport plus `send` and `isOpen`. Supply
one and the plugin uses it untouched:

```ts
lankaWebSocket({ transport: myNativeChannel });
```

The usual reasons: a React Native application whose socket lives on the native
side, an Electron renderer talking over IPC, a socket the application already
opened for something else, or a double in a test.

Writing one is short, because `ALankaStreamTransport` from `lanka/stream`
already owns the listener registry, dispatch, the reconnect ladder and
`onReconnect`. You write `open` and `close`:

```ts
class NativeChannel extends ALankaStreamTransport implements ILankaWebSocketChannel {
	protected open(handlers: ILankaStreamTransportHandlers): void {
		this.wire = handlers;
		nativeBridge.onMessage((type, payload) => handlers.received(type, payload));
		nativeBridge.onReady(() => handlers.opened());
		nativeBridge.onGone(() => handlers.lost());
	}

	protected close(): void {
		nativeBridge.detach();
	}
}
```

`open` may throw: it means "this engine cannot do it", and the transport goes
quiet rather than retrying what cannot succeed.

## Swapping the wire under an application

Because both implement `ILankaServerEventTransport`, a socket transport drops
straight into the SSE plugin:

```ts
lankaSse({ transport: createLankaWebSocketTransport({ path: "/ws/events" }) });
```

Every bridge, scenario and screen is untouched. That is the case the port was
written for: a proxy that strips `text/event-stream` leaves an application with
a WebSocket and nothing else.

## Never do these

- **Never subscribe to the channel directly** from a screen. You lose the marker
  and the disposal, which are the two things bridges exist for.
- **Never send from a bridge.** Give the channel to a gateway or a ViewModel.
- **Never read `isActive()` after an `await`.** Read it first, keep the boolean.
- **Never connect on install.**
- **Never treat `onReconnect` as "connected".** It means "you missed something".
- **Never switch the heartbeat on without knowing the server answers pings.**

## Symptom → cause

| What you see                              | What it is                                        |
| ----------------------------------------- | ------------------------------------------------- |
| a toast about the user's own message      | the marker was not set — subscribed directly      |
| the screen is stale and nothing errored   | a half-open socket; switch the heartbeat on       |
| a message vanished during a reconnect     | `queueWhileClosed: false`, or the outbox overflowed |
| every message arrives twice               | two connections — `connect()` called on each render |
| a connection open on the sign-in screen   | `connectOnInstall: true`                          |
| nothing arrives and no frame is refused   | the backend's envelope is not the default one     |
| stale data after a dropped connection     | no `onReconnect` refetch                          |

---

What it is: [README.md](https://github.com/lankajs/lanka/blob/main/plugins/websocket/README.md) · What may not change:
[SKILL.md](https://github.com/lankajs/lanka/blob/main/plugins/websocket/SKILL.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
