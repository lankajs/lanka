# @lankajs/plugin-sse — user guide

Server-sent events as a source of change: one connection, your bridges from a
server event to an application scenario, and the marker that tells a handler
"this change came from outside".

## You will learn

- how a server event becomes an application scenario
- why the plugin does not connect by itself
- what the "from outside" marker prevents, and where it stops

## When to reach for this

Reach for it when the server pushes changes the screen must reflect. Polling a
list every thirty seconds is `@lankajs/async`, not this.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-sse
```

`lanka` is a peer dependency: the plugin plugs into the _same_ core instance you
created.

## Quick start

```ts
import { lankaSse, createLankaSseBridge } from "@lankajs/plugin-sse";

const todoBridge = createLankaSseBridge(({ on, onReconnect }) => {
	on("todo.completed", (data) => todoCompleted.trigger(data as { id: number }));
	onReconnect(() => void todosVM.load()); // catch up on what was missed
});

const sse = lankaSse({
	path: "/sse/events",
	bridges: ({ sse, trigger }) => [todoBridge(sse, trigger)],
	refreshAuth: () => session.refresh(),
	onSessionLost: () => session.signOut(),
});

lanka.use(sse);

// when the user is authenticated:
sse.sse.connect();
```

## Why it does not connect by itself

`connectOnInstall` is **off by default**. The stream is opened for an
_authenticated_ user, and when that happens is your knowledge. A plugin that
connected on registration would open a connection on the sign-in screen.

## Bridges

A bridge is the one thing the package cannot write for you: which server events
exist, and which of your scenarios each one means.

**As a factory:**

```ts
const roomBridge = createLankaSseBridge(({ on, onSignal, onReconnect }) => {
	on("room.participant.joined", (data) => participantJoined.trigger(data));
	onSignal("room.closed", () => roomClosed.trigger());
	onReconnect(() => void room.refresh());
});
```

**As a class**, when the bridge has state of its own:

```ts
import { ALankaSseBridge } from "@lankajs/plugin-sse";

class RoomBridge extends ALankaSseBridge {
	public register(): void {
		this.on("room.participant.joined", (data) => participantJoined.trigger(data));
		this.onReconnect(() => void room.refresh());
	}
}
```

Both are the same class; the plugin cannot tell which style wrote a bridge.

| Hook                      | For                                     |
| ------------------------- | --------------------------------------- |
| `on(type, handler)`       | an event with a payload                 |
| `onSignal(type, handler)` | an event with none                      |
| `onReconnect(handler)`    | catch-up after the connection came back |

**Subscriptions are collected and released on `dispose()`.** A bridge that
subscribes and never unsubscribes cannot notice the problem while it lives as
long as the application — but a plugin is removed, an instance is disposed, a dev
server reloads the module, and a leftover subscription keeps triggering a dead
instance's scenarios.

### `onReconnect` is not `onConnect`

It fires after a connection is **re-established**, never on the first one.
Everything that happened while the connection was down was missed, so a screen
refetches rather than assuming it is current.

## The "from outside" marker

```ts
if (sse.trigger.isActive()) {
	// we are inside a server-event handler
}
```

A handler that updates state cannot otherwise tell its own change from someone
else's: the user presses a button, and then receives the server event _about_
that button. Without the marker the screen notifies the user about their own
action, and an optimistic update is rolled back by a "foreign" response that in
fact confirms it.

The bridge sets it for you — that is why `on` exists rather than "subscribe
yourself". A handler that forgot the marker is indistinguishable from a user
action, and the difference is silent: the screen simply behaves oddly in a rare
case.

**The marker is synchronous.** It holds for the duration of the call and is
cleared in `finally`. An `await` inside your handler leaves it behind — honestly
so: after an await, control has been anywhere, and claiming "we are still inside
a server event" would be untrue.

## Connection settings

```ts
lankaSse({
	path: "/sse/events", // relative to host.apiBaseUrl
	withCredentials: true, // default: the session usually lives in cookies
	maxReconnectAttempts: 10,
	maxReconnectDelayMs: 30_000,
	reconnectJitter: "full", // default; "equal" or "none"
	refreshAuth: () => session.refresh(),
	refreshAuthOn: "first-refused-reconnect", // default; "exhausted" refreshes only at the ceiling
	onSessionLost: () => session.signOut(),
	heartbeat: { event: "ping", timeoutMs: 25_000 }, // off by default
	visibility: { whileHidden: "pause", onVisible: "reconnect" }, // default: "continue", "resume"
});
```

`refreshAuth` is a **function, not a URL**, for the same reason as in
[`@lankajs/plugin-http`](../http/GUIDE.md): a plugin that knew the endpoint would
also have to know the response shape and how your session is stored.

### How the stream comes back

Each pause doubles from one second up to `maxReconnectDelayMs`, and is
**jittered**: `"full"` waits anywhere up to the step, `"equal"` at least half of
it, `"none"` exactly the step, as 6.x did. After a deploy every client loses its
stream in the same second; without jitter all of them return — and resync through
`onReconnect` — in the same second, on every rung.

**An expired token is refreshed at the first refused reconnect.** `EventSource`
cannot see a 401, so a refused connection looks like a network error. With
`refreshAuthOn: "first-refused-reconnect"` (the default), a reconnect to a stream that had
been open, refused before it opens, calls `refreshAuth` — once per outage. `true`
reconnects at once. `false` is **not** a lost session: in a real outage the
refresh fails for the same reason the stream did, and the ladder goes on. The
attempt ceiling still calls `refreshAuth` and, refused there, `onSessionLost`.

**`heartbeat` catches a half-open stream.** After a network switch a connection
can stay open, fire no error and deliver nothing for minutes. With a heartbeat,
no frame of any kind for `timeoutMs` closes it and reconnects through the ladder,
so `onReconnect` runs as for any other drop. `event` names the server's
keep-alive; any frame the browser dispatches counts. An event with empty data
reaches a bridge as `{}`.

**The keep-alive must be an event the browser dispatches**: a named event with a
`data:` line, even an empty one (`event: ping
data:

`). An SSE comment
(`: ping`) and an event with no `data:`line never reach script, so with them
the watchdog sees silence and reconnects a healthy stream every`timeoutMs`.

**`visibility` is for mobile WebViews**, which keep running in the background
with the network gone. `whileHidden: "pause"` makes no attempt while the page is
hidden — and counts none, so the ceiling is not reached while nobody is looking.
`onVisible: "reconnect"` connects at once when the page returns with no connection,
from the bottom of the ladder, with the outage's early refresh given back. A
page that has never reported `visible` is treated as if the option were off:
some WebViews report `hidden` from load. One that WAS visible, paused, and then
never reports `visible` again stays paused until it does — `"pause"` trusts the
page once it has spoken.

## The event envelope

The transport accepts `{ trigger, payload }` and unwraps it. A **bare body** is
accepted too — refusing it would silently lose events for a backend that still
sends the second form.

## Bringing your own connection

```ts
lankaSse({ transport: myWebSocketTransport });
```

`ILankaServerEventTransport` is five members: `isSupported`, `connect`,
`disconnect`, `on`, `onReconnect`. That is exactly what a bridge needs, and
nothing above it — bridges, the marker, the plugin — can tell which transport
answered.

The port exists because the second transport is a matter of _when_, not
_whether_: a proxy that strips `text/event-stream` leaves an application with a
WebSocket and nothing else, and long-polling is the same shape again.

That case is now one line, because
[`@lankajs/plugin-websocket`](../websocket/GUIDE.md) ships a transport behind the
same port:

```ts
lankaSse({ transport: createLankaWebSocketTransport({ path: "/ws/events" }) });
```

Every bridge, scenario and screen is untouched.

### The half that is not about SSE

`ALankaSseBridge`, `createLankaSseBridge` and the marker are re-exported from
[`lanka/stream`](../../core/GUIDE.md#streams--a-change-that-arrives-from-the-server)
under the names this package published first — they are the same objects a
socket, a GraphQL subscription or a gRPC stream uses. You can import them from
either place; a bridge written against one works with the other.

## Teardown

Removing the plugin (or disposing the instance) detaches every bridge **before**
closing the stream. Doing it the other way round leaves the bridges a chance to
receive one last event from a dead connection.

## Common mistakes

**Subscribing to the transport directly instead of through a bridge.** You lose
the marker and the disposal, which are the two things bridges exist for.

**Checking `isActive()` after an `await`.** It is synchronous. Read it first, keep
the boolean.

**Connecting on install.** See above — the sign-in screen does not need a stream.

**Treating `onReconnect` as "connected".** It is "you missed something".

## Recap

- Bridges are yours: the package knows no event type.
- `connectOnInstall` is off by default — the stream is for an authenticated user.
- The marker stops a screen notifying a user about their own action; it is synchronous and ends at the first `await`.
- `onReconnect` means "you missed something", not "connected".
- Teardown detaches bridges before closing the stream.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Scenarios: [../../core/GUIDE.md](../../core/GUIDE.md)
