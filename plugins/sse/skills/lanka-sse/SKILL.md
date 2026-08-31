---
name: lanka-sse
description: Wire server-sent events into a lanka application — one connection, bridges from a server event to a scenario, and the marker that says a change came from outside. Use when adding realtime updates, when a screen must react to a server push, when the app notifies a user about their own action, or when reviewing code that imports `@lankajs/plugin-sse`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-sse
    version: "1.0.0"
---

# @lankajs/plugin-sse

One transport, your bridges, and the "from outside" marker. `reference.md` beside
this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Setup

```ts
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
sse.sse.connect(); // when the user is authenticated — NOT on install
```

`connectOnInstall` is off by default on purpose: the stream is for an
authenticated user, and a plugin that connected on registration would open a
connection on the sign-in screen.

## Bridges

A bridge is the one thing the package cannot write for you: which server events
exist, and which of your scenarios each one means.

| Hook                      | For                              |
| ------------------------- | -------------------------------- |
| `on(type, handler)`       | an event with a payload          |
| `onSignal(type, handler)` | an event with none               |
| `onReconnect(handler)`    | catch-up after the link returned |

The class form (`ALankaSseBridge`, implement `register()`) is for a bridge with
state of its own. Both are the same class.

Subscriptions are collected and released on `dispose()` — which the plugin calls
for you, before closing the stream.

**`onReconnect` is not `onConnect`.** It fires only after a reconnection: what
happened while the link was down was missed, so refetch instead of assuming you
are current.

## The "from outside" marker

```ts
if (sse.trigger.isActive()) {
	/* we are inside a server-event handler */
}
```

Without it a handler cannot tell its own change from someone else's: the user
presses a button and then receives the server event about that button. The screen
notifies the user about their own action, and an optimistic update is rolled back
by a "foreign" response that in fact confirms it.

The bridge sets it for you. It is **synchronous** — read it before any `await`;
after one, control has been anywhere and the marker is honestly gone.

## Bringing your own connection

`transport: myWebSocketTransport` — `ILankaServerEventTransport` is five members
(`isSupported`, `connect`, `disconnect`, `on`, `onReconnect`), and nothing above
it can tell which transport answered. The port exists because a proxy that strips
`text/event-stream` leaves an application with a WebSocket.

## Never do these

- **Never subscribe to the transport directly.** You lose the marker and the
  disposal, which are the two things bridges exist for.
- **Never read `isActive()` after an `await`.** Read it first, keep the boolean.
- **Never connect on install.**
- **Never treat `onReconnect` as "connected".** It means "you missed something".
- **Never fork the coalescer or the guard** — they are re-exported from
  `@lankajs/async`.

## Symptom → cause

| What you see                            | What it is                                      |
| --------------------------------------- | ----------------------------------------------- |
| a toast about the user's own action     | the marker was not set — subscribed directly    |
| an optimistic update reverted by a push | same                                            |
| events after sign-out                   | bridges not disposed, or the plugin not removed |
| a connection open on the sign-in screen | `connectOnInstall: true`                        |
| stale data after a dropped connection   | no `onReconnect` refetch                        |

## More

`reference.md` — the full guide, including the envelope format and reconnect
settings.
