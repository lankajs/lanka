<!-- Generated from plugins/graphql/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/plugin-graphql@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/plugin-graphql`.
>
> Complete code, compiled and run in CI: [plugins/graphql/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/plugins/graphql/_playground/playground.test.ts)

# @lankajs/plugin-graphql — user guide

GraphQL in two halves that are used apart: operations, where the point is that
`200 OK` with an `errors` array becomes a failure your screen can branch on; and
subscriptions, where the point is that a frame becomes a scenario the rest of the
application already understands.

## You will learn

- why a GraphQL request needs its own request kind at all
- when a `200` is a failure, and when it is a page that rendered
- how to write a gateway in either style
- how a subscription reaches a scenario without anything above knowing it is
  GraphQL

## When to reach for this

Reach for it when your API is GraphQL. If you only ever send one operation from
one place, `createLankaGraphqlRequest()` handed to a gateway you already have is
the whole of it; the gateway base and the plugin are for applications where
GraphQL is the API rather than a corner of it.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-graphql
```

`lanka` is a peer dependency. There is no GraphQL client dependency and there
will not be one — see [What is not here](#what-is-not-here).

## The one thing this package is really for

**GraphQL answers `200 OK` with an `errors` array.**

Through an ordinary JSON request that is a _success_ carrying a body your screen
then has to inspect. So every application grows the same helper, and the ones
that forget show a spinner over a failed mutation until the user reloads.

`LankaGraphqlRequest` reads the answer and throws `LankaError` with
`kind: "domain"` — the kind the framework already has for a server refusing
deliberately and naming the reason:

```ts
try {
	await todoGateway.complete(id);
} catch (error) {
	if (LankaError.is(error) && error.kind === "domain") {
		toast(error.message); // what the server said
		if (error.code === "FORBIDDEN") signOut(); // extensions.code
	}
}
```

Retry policy leaves a `domain` failure alone, an error boundary shows what the
server said, and nothing above had to learn that this endpoint is GraphQL.

### What counts as what

| The answer                  | What you get                              |
| --------------------------- | ----------------------------------------- |
| non-2xx                     | `LankaError` `kind: "http"`, with `status` |
| `errors`, `data` null       | `LankaError` `kind: "domain"`             |
| `errors`, `data` present    | the data — and `onPartialErrors` is called |
| no `data` key at all        | `LankaError` `kind: "schema"`             |
| not JSON                    | `LankaError` `kind: "schema"`             |

The third row is the one worth arguing about, and it is not a judgement call: a
partial result means a nullable field resolved to `null` and said why, while the
rest of the page resolved. Throwing it away is throwing away a page that
rendered.

```ts
createLankaGraphqlRequest({
	onPartialErrors: (errors) => logger.warn("partial GraphQL result", errors),
});
```

## Quick start — a gateway

**As a class**, which is what most applications write for gateways:

```ts
import { ALankaGraphqlGateway } from "@lankajs/plugin-graphql";

const TODOS = `query Todos { todos { id title done } }`;
const COMPLETE = `mutation Complete($id: ID!) { completeTodo(id: $id) { id done } }`;

class TodoGateway extends ALankaGraphqlGateway {
	public list() {
		return this.query<{ todos: ITodo[] }>({ document: TODOS });
	}

	public complete(id: string) {
		return this.mutate<{ completeTodo: ITodo }>({ document: COMPLETE, variables: { id } });
	}
}
```

**By calling**, over the same implementation:

```ts
const todoGateway = createLankaGraphqlGateway({
	methods: ({ query, mutate }) => ({
		list: () => query<{ todos: ITodo[] }>({ document: TODOS }),
		complete: (id: string) =>
			mutate<{ completeTodo: ITodo }>({ document: COMPLETE, variables: { id } }),
	}),
});
```

The context `{ query, mutate }` is the class's protected surface handed over as
an object: switching styles moves `this.query(...)` to `query(...)` and changes
nothing else.

You get **`data`**, not the envelope around it. A ViewModel that had to unwrap
`{ data: … }` would be unwrapping the protocol on every screen.

### `query` and `mutate` are the same POST

Deliberately both, and it is worth saying the quiet part: on the wire they are
identical, because GraphQL sends everything as a POST to one URL. The **name is
the only place a call says whether it changes anything** — not the method, not
the path, not a log line. That is why there are two members and not one.

### The endpoint

`basePath` defaults to `/graphql`, joined to `host.apiBaseUrl`:

```ts
class TodoGateway extends ALankaGraphqlGateway {
	public constructor() {
		super({ basePath: "/api/graphql" });
	}
}
```

## Documents

`document` takes a string, a `TypedDocumentNode` from a code generator, or
anything that prints as one:

```ts
import { TodosDocument } from "./generated/graphql"; // graphql-codegen

query<TodosQuery>({ document: TodosDocument });
```

The package never parses GraphQL. `readLankaGraphqlDocument` reads the source a
generator already attached at `loc.source.body`; shipping a parser to redo that
at runtime would be paying twice for one answer.

## Using it with a gateway you already have

The request kind is independent of the gateway base. Hand it to anything:

```ts
class MixedGateway extends ALankaGateway<RequestInit> {
	public constructor() {
		super({ request: createLankaGraphqlRequest(), basePath: "/graphql" });
	}
}
```

Or give it a transport of your own — a test double, a native bridge:

```ts
createLankaGraphqlRequest({ transport: myTransport });
```

## Subscriptions

A subscription is a **connection**, and a connection needs a lifetime to belong
to. That is the only reason there is a plugin:

```ts
import { lankaGraphql, createLankaStreamBridge } from "@lankajs/plugin-graphql";

const TODO_COMPLETED = `subscription { todoCompleted { id } }`;

const todoBridge = createLankaStreamBridge(({ on, onReconnect }) => {
	on("todo.completed", (payload) => {
		todoCompleted.trigger(payload.todoCompleted as { id: string });
	});
	onReconnect(() => void todosVM.load()); // catch up on what was missed
});

const graphql = lankaGraphql({
	operations: { "todo.completed": { document: TODO_COMPLETED } },
	connectionParams: () => ({ authorization: session.token() }),
	bridges: ({ subscriptions, trigger }) => [todoBridge(subscriptions, trigger)],
});

lanka.use(graphql);

// when the user is authenticated:
graphql.subscriptions.connect();
```

An application using GraphQL **without** subscriptions never installs this and
loses nothing.

### The mapping is event type → operation

`graphql-ws` multiplexes by an id per subscription, and an id means nothing to a
bridge. `operations` gives each one a name, so the layer above subscribes to
`"todo.completed"` whether the wire is this, SSE or a socket — which is the only
reason the protocol can change without touching a screen.

What a bridge receives is the subscription's `data` object:

```ts
on("todo.completed", (payload) => {
	// payload === { todoCompleted: { id: "7" } }
});
```

### `connectionParams` is a function

```ts
connectionParams: () => ({ authorization: session.token() });
```

A token read once at construction is the token the application had on the
sign-in screen, and every reconnect an hour later would present an expired one.
It may return a promise, for a refresh that has to happen first.

### Why it does not connect by itself

`connectOnInstall` is **off by default**. A subscription is opened for an
_authenticated_ user; a plugin that connected on registration would open a
socket on the sign-in screen and present no token.

### The handshake, and what it protects

The transport speaks `graphql-transport-ws`: `connection_init` →
`connection_ack`, one `subscribe` per operation, `next` / `error` / `complete`,
and `ping` / `pong` answered for you.

Two things follow that are easy to get wrong by hand:

- **Nothing subscribes before the acknowledgement.** A conforming server answers
  `4401` to a `subscribe` that arrives first, and the reconnect ladder then loops
  against a socket that is working.
- **A handshake that is never acknowledged counts as a lost link.**
  `connectionAckTimeoutMs` (10s) exists because the alternative is a socket that
  upgraded, does nothing, and reports nothing.

### Reconnection

Growing backoff from `reconnectDelayMs` (1s) to `maxReconnectDelayMs` (30s) for
`maxReconnectAttempts` (10) tries, then one `refreshAuth`, then `onSessionLost`.

**Every subscription is sent again** after the link comes back, because the far
end forgot all of them. `onReconnect` on a bridge is how a screen refetches what
it missed in between — it is not `onConnect`, and it never fires on a first
connection.

### A subscription the server refuses

```ts
lankaGraphql({
	onOperationError: (eventType, errors) => logger.error(eventType, errors),
});
```

An `error` frame ends that subscription; the next reconnect asks again.

### Bringing your own socket

```ts
lankaGraphql({
	openSocket: (url, { onOpen, onFrame, onClosed }) => {
		const socket = myNativeSocket(url);
		socket.on("open", onOpen);
		socket.on("message", onFrame);
		socket.on("close", onClosed);
		return { send: (frame) => socket.write(frame), close: () => socket.end() };
	},
});
```

Or replace the whole transport, when subscriptions do not arrive over
`graphql-ws` at all — SSE, or a socket the application already had:

```ts
lankaGraphql({ transport: createLankaSseTransport({ path: "/graphql/stream" }) });
```

Bridges above cannot tell.

## The "from outside" marker

```ts
if (graphql.trigger.isActive()) {
	/* we are inside a subscription handler */
}
```

Without it a handler cannot tell its own change from someone else's: the user
completes a todo and then receives the subscription frame about it. The screen
notifies the user about their own action, and an optimistic update is rolled back
by a "foreign" frame that in fact confirms it.

The bridge sets it for you. It is **synchronous** — read it before any `await`.

## What is not here

No cache, no normalisation, no fragment registry, no document parser, no
`@client` directives.

A ViewModel already owns the state a screen reads. A second store under it is the
arrangement `ARCHITECTURE.md` argues against: two places holding one truth, kept
in step by hand, disagreeing on a slow answer. If you want normalised caching,
that is a different tool and it does not belong under a transport.

## Never do these

- **Never unwrap `{ data }` in a ViewModel.** The request kind already did.
- **Never treat a `200` as success without reading `errors`** — which is exactly
  what happens if you send GraphQL through `LankaFetchJsonRequest`.
- **Never throw away a partial result.** Use `onPartialErrors`.
- **Never call `print(document)` at a call site.** Pass the document.
- **Never subscribe to the transport directly** from a screen: you lose the
  marker and the disposal.
- **Never connect on install.**

## Symptom → cause

| What you see                                     | What it is                                              |
| ------------------------------------------------ | ------------------------------------------------------- |
| a spinner over a failed mutation                 | the operation went through a plain JSON request kind    |
| `data` is `undefined` in a ViewModel             | the ViewModel is unwrapping the envelope a second time  |
| `kind: "schema"` on every call                   | the endpoint is wrong — an SPA fallback is answering    |
| a subscription never delivers, and nothing errors | the server never acknowledged; watch for the ack timeout |
| subscriptions stop after a reconnect             | a hand-written client that did not re-subscribe         |
| `4401` in the socket close reason                | `subscribe` sent before `connection_ack`                |
| an expired token after an hour                   | `connectionParams` given as a value instead of a function |

---

What it is: [README.md](https://github.com/lankajs/lanka/blob/main/plugins/graphql/README.md) · What may not change:
[SKILL.md](https://github.com/lankajs/lanka/blob/main/plugins/graphql/SKILL.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
