---
name: lanka-graphql
description: Wire GraphQL into a lanka application — a request kind that reads the errors array as a tagged failure, a gateway with query and mutate, and graphql-ws subscriptions bridged into scenarios. Use when the API is GraphQL, when a 200 with errors is being treated as a success, when adding subscriptions, or when reviewing code that imports `@lankajs/plugin-graphql`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-graphql
    version: "2.0.0"
---

# @lankajs/plugin-graphql

Two halves used apart: operations, and subscriptions. `reference.md` beside this
file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## The one thing to get right

**GraphQL answers `200 OK` with an `errors` array.** Sent through
`LankaFetchJsonRequest` that is a success carrying a body the screen has to
inspect — and the screen that forgets shows a spinner over a failed mutation.

`LankaGraphqlRequest` turns it into `LankaError` with `kind: "domain"`:

```ts
catch (error) {
	if (LankaError.is(error) && error.kind === "domain") {
		toast(error.message);                                  // what the server said
		if (error.code === "FORBIDDEN") session.signOut();     // extensions.code
	}
}
```

| The answer                | What you get                               |
| ------------------------- | ------------------------------------------ |
| non-2xx                   | `kind: "http"`, with `status`              |
| `errors`, `data` null     | `kind: "domain"`, `code`, `issues`         |
| `errors`, `data` present  | **the data** — and `onPartialErrors` fires |
| no `data` key, or not JSON | `kind: "schema"`                          |

Row three is not a judgement call: a partial result is a page that rendered with
one nullable field `null`. Throwing it away throws the page away.

## A gateway

```ts
class TodoGateway extends ALankaGraphqlGateway {
	public list() {
		return this.query<{ todos: ITodo[] }>({ document: TODOS });
	}
	public complete(id: string) {
		return this.mutate<{ completeTodo: ITodo }>({ document: COMPLETE, variables: { id } });
	}
}
```

Or by calling, over the same implementation:

```ts
const todoGateway = createLankaGraphqlGateway({
	methods: ({ query, mutate }) => ({
		list: () => query<{ todos: ITodo[] }>({ document: TODOS }),
	}),
});
```

You get **`data`**, not the envelope. `basePath` defaults to `/graphql`.

`document` takes a string or a generated `TypedDocumentNode` — never call
`print()` at a call site. The package does not parse GraphQL.

**`query` and `mutate` are the same POST.** The name is the only place a GraphQL
call says whether it changes anything.

Already have a gateway? `super({ request: createLankaGraphqlRequest(), basePath: "/graphql" })`.

## Subscriptions

Only subscriptions need `lanka.use()` — a subscription is a connection, and a
connection needs a lifetime.

```ts
const graphql = lankaGraphql({
	operations: { "todo.completed": { document: TODO_COMPLETED } },
	connectionParams: () => ({ authorization: session.token() }),
	bridges: ({ subscriptions, trigger }) => [todoBridge(subscriptions, trigger)],
});

lanka.use(graphql);
graphql.subscriptions.connect(); // when authenticated — NOT on install
```

`operations` maps an event type to a document, so a bridge subscribes to
`"todo.completed"` whatever the wire is. What a bridge receives is the
subscription's `data` object:

```ts
on("todo.completed", (payload) => {
	// payload === { todoCompleted: { id: "7" } }
});
```

`connectionParams` is a **function**: a token read once is the token from the
sign-in screen, and every reconnect an hour later presents an expired one.

The handshake, re-subscription after a reconnect, `ping`/`pong` and the
acknowledgement timeout are handled for you.

## The "from outside" marker

```ts
if (graphql.trigger.isActive()) {
	/* inside a subscription handler */
}
```

The bridge sets it. It is **synchronous** — read it before any `await`.

## What this package is not

No cache, no normalisation, no fragment registry, no document parser. A ViewModel
already owns the state a screen reads.

## Never do these

- **Never send GraphQL through `LankaFetchJsonRequest`.** A `200` with `errors`
  becomes a success.
- **Never unwrap `{ data }` in a ViewModel.** The request kind did.
- **Never throw away a partial result.** Use `onPartialErrors`.
- **Never call `print(document)` at a call site.**
- **Never subscribe to the transport directly** from a screen.
- **Never connect on install.**
- **Never pass `connectionParams` as a value.**

## Symptom → cause

| What you see                                      | What it is                                          |
| ------------------------------------------------- | --------------------------------------------------- |
| a spinner over a failed mutation                  | the operation went through a plain JSON request kind |
| `data` is `undefined` in a ViewModel              | the ViewModel unwraps the envelope a second time     |
| `kind: "schema"` on every call                    | the endpoint is wrong — an SPA fallback is answering |
| a subscription never delivers, nothing errors     | the server never acknowledged                        |
| subscriptions stop after a reconnect              | a hand-written client that did not re-subscribe      |
| `4401` in the socket close reason                 | `subscribe` sent before `connection_ack`             |
| an expired token after an hour                    | `connectionParams` given as a value                  |

## More

`reference.md` — the full guide, including bringing your own socket and running
subscriptions over something that is not `graphql-ws`.
