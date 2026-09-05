<!-- Generated from plugins/grpc/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/plugin-grpc@1.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/plugin-grpc`.
>
> Complete code, compiled and run in CI: [plugins/grpc/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/plugins/grpc/_playground/playground.test.ts)

# @lankajs/plugin-grpc — user guide

gRPC-Web without a generated client: the framing, the trailers and the status
codes, with the message codec left to whoever generated your message types.

## You will learn

- why the codec is yours and the framing is not
- what a `grpc-status` becomes, and why the mapping matters
- how to write a gateway in either style
- how a server stream reaches a scenario without anything above knowing it is
  gRPC

## When to reach for this

Reach for it when the backend speaks gRPC and the client is a browser or a React
Native app — which means gRPC-Web or Connect over HTTP, because a browser cannot
open an HTTP/2 stream by itself. If you already run a generated client library
and are happy with it, you do not need this; if you are about to write the
framing by hand for the third time, you do.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-grpc
```

`lanka` is a peer dependency. There is **no protobuf dependency** and there will
not be one — see [The codec is yours](#the-codec-is-yours).

## The codec is yours

A message codec belongs to whatever generated the message types. Shipping one
would pick your code generator for you and add a dependency for everyone who
chose differently. So the seam is two functions:

```ts
interface ILankaGrpcCodec<TRequest, TResponse> {
	encode: (message: TRequest) => Uint8Array;
	decode: (bytes: Uint8Array) => TResponse;
}
```

With `protobuf-es`:

```ts
const codec: ILankaGrpcCodec<ListTodosRequest, ListTodosResponse> = {
	encode: (message) => toBinary(ListTodosRequestSchema, message),
	decode: (bytes) => fromBinary(ListTodosResponseSchema, bytes),
};
```

With `ts-proto`:

```ts
const codec = {
	encode: (message) => ListTodosRequest.encode(message).finish(),
	decode: (bytes) => ListTodosResponse.decode(bytes),
};
```

And one is shipped, for a server speaking `application/grpc-web+json` — and for
tests, where being able to read what went over the wire is the difference
between a readable failure and a hex dump:

```ts
const codec = createLankaGrpcJsonCodec<IListTodos, ITodoList>();
```

It is deliberately **not** the default: a gRPC server speaks protobuf unless
somebody configured it otherwise, and a default that silently sent JSON would
fail as a decoding error inside the server.

## A method is a path and a codec

```ts
const LIST: ILankaGrpcMethod<IListTodos, ITodoList> = {
	path: "/todos.v1.Todos/List",
	codec: listCodec,
};
```

`path` is written as the server declares it. A package name, a service name and
a method name joined by this library would be three fields to get wrong; the one
string is copied from the `.proto` and is checkable by eye.

## Quick start — a gateway

**As a class:**

```ts
import { ALankaGrpcGateway } from "@lankajs/plugin-grpc";

class TodoGateway extends ALankaGrpcGateway {
	public list(page: number) {
		return this.unary(LIST, { page });
	}

	public complete(id: string) {
		return this.unary(COMPLETE, { id });
	}
}
```

**By calling**, over the same implementation:

```ts
const todoGateway = createLankaGrpcGateway({
	methods: ({ unary }) => ({
		list: (page: number) => unary(LIST, { page }),
		complete: (id: string) => unary(COMPLETE, { id }),
	}),
});
```

The context `{ unary }` is the class's protected surface handed over as an
object: switching styles moves `this.unary(...)` to `unary(...)` and changes
nothing else.

### The content type

`application/grpc-web+proto` by default. With the JSON codec, say so:

```ts
new TodoGateway({ contentType: "application/grpc-web+json" });
```

### Mock mode round-trips the codec

A mock handler answers a **message**, which is encoded and decoded again on the
way through:

```ts
this.unary(COMPLETE, { id }, undefined, () => Promise.resolve({ id, done: true }));
```

That looks like waste and is not: mock mode stays on the same code path as the
real call, so the codec is exercised by every development run rather than first
meeting a real message in production.

## What a status becomes

Sixteen gRPC codes into five kinds. The mapping is a decision, not a lookup —
each kind means something different to the interface:

| Status                       | `LankaError.kind` | Because                                     |
| ---------------------------- | ----------------- | ------------------------------------------- |
| `CANCELLED`                  | `aborted`         | the user left; nothing is shown             |
| `DEADLINE_EXCEEDED`          | `timeout`         | shown, and worth another try                |
| `UNAVAILABLE`                | `network`         | a retry is the right offer                  |
| `UNIMPLEMENTED`, `INTERNAL`  | `http`            | nobody's doing, and not a refusal           |
| everything else non-zero     | `domain`          | the server reached the handler and said no  |
| a real HTTP status           | `http`            | it failed BELOW gRPC — a proxy, a bad route |

`code` carries the status **name**, because `error.code === "PERMISSION_DENIED"`
is a line somebody can read and `error.code === "7"` is a line somebody has to
look up:

```ts
catch (error) {
	if (LankaError.is(error) && error.code === "UNAUTHENTICATED") session.signOut();
}
```

Without the mapping a cancelled call and a failed one look the same, and the
user is shown an error for leaving the screen.

### The status arrives in two places

In the trailers frame at the end of the body, and — for a call that failed
before any message — in the HTTP headers. Both are read, and that is not
belt-and-braces: a trailers-only response has no body to find them in, and a
reader that knew only one of the two would report a schema failure for an
ordinary permission denial.

## Server streams

A stream is a **connection**, and a connection needs a lifetime to belong to.
That is the only reason there is a plugin:

```ts
import { lankaGrpc, createLankaGrpcStreamTransport, createLankaStreamBridge } from "@lankajs/plugin-grpc";

const watch = createLankaGrpcStreamTransport<IWatchRequest, IChange>({
	path: "/todos.v1.Todos/Watch",
	request: { since: 0 },
	codec: changeCodec,
	eventTypeOf: (change) => (change.kind === "completed" ? "todo.completed" : null),
	payloadOf: (change) => ({ id: change.id }),
});

const todoBridge = createLankaStreamBridge(({ on, onReconnect }) => {
	on("todo.completed", (payload) => todoCompleted.trigger({ id: String(payload.id) }));
	onReconnect(() => void todosVM.load());
});

const grpc = lankaGrpc({
	transport: watch,
	bridges: ({ stream, trigger }) => [todoBridge(stream, trigger)],
});

lanka.use(grpc);

// when the user is authenticated:
grpc.stream.connect();
```

`transport` is **required** here, unlike the other transports in this repository,
and the reason is the codec: a stream cannot be built without knowing how its
messages are encoded, and this package must not guess.

### `eventTypeOf` is the whole mapping

A server stream is ONE call carrying many kinds of thing. There is no per-event
channel and no subscription protocol, so the name has to come out of the message
— which means the application decides. The alternative is a convention about a
field name, and a convention is a rule nobody can check.

Return `null` to drop a message. `payloadOf` shapes what the bridge receives, and
defaults to the decoded message.

### An ended stream is a link to re-establish

A server that closes the stream — cleanly, or with a failing status — enters the
same reconnect ladder as a dropped one: growing backoff from `reconnectDelayMs`
(1s) to `maxReconnectDelayMs` (30s) for `maxReconnectAttempts` (10) tries, then
`refreshAuth`, then `onSessionLost`.

A stream that ended and stayed ended would be a screen that is quietly
permanently stale. Use `onStatusFailure` to see why it ended:

```ts
createLankaGrpcStreamTransport({ onStatusFailure: (error) => logger.warn(error) });
```

It is reported rather than thrown because nobody is awaiting a stream: a throw
would become an unhandled rejection and reach no log you control.

### Partial frames are handled for you

Bytes arrive in chunks the network chose. A five-byte header can be split across
two reads and a message across ten, so what is not yet a whole frame is kept and
joined to what comes next. A reader that assumed each chunk held whole frames
works in every test and drops messages under load — which is the failure that
never reproduces.

### Bringing your own stream

```ts
createLankaGrpcStreamTransport({
	openStream: (url, init) => myFetch(url, init),
});
```

Anything answering a `Response` with a body works: a proxying fetch, a native
bridge, a test that pushes bytes.

## Using it with a gateway you already have

The request kind is independent of the gateway base. It answers the response
message's **bytes**, so a consumer with their own gateway story keeps it:

```ts
const request = createLankaGrpcRequest();
const bytes = await request.execute<Uint8Array>(url, { method: "POST", body: framed });
```

## The "from outside" marker

```ts
if (grpc.trigger.isActive()) {
	/* we are inside a stream handler */
}
```

Without it a handler cannot tell its own change from someone else's: the user
completes a todo and then receives the stream message about it. The bridge sets
it for you, and it is **synchronous** — read it before any `await`.

## What is not here

No code generation, no `.proto` parsing, no protobuf runtime, no bidirectional
streaming (a browser cannot do it over gRPC-Web), and no client-side streaming
for the same reason.

## Never do these

- **Never send JSON to a protobuf server** by leaving `contentType` at its
  default while using the JSON codec.
- **Never build a path out of parts.** Copy it from the `.proto`.
- **Never treat `aborted` as an error to show.** The user left.
- **Never subscribe to the stream directly** from a screen: you lose the marker
  and the disposal.
- **Never connect on install.**

## Symptom → cause

| What you see                                     | What it is                                          |
| ------------------------------------------------ | --------------------------------------------------- |
| a `415` from the server                          | the content type does not match the codec           |
| `kind: "schema"` with "carried no message"       | a proxy stripped the body, or buffered the trailers |
| an error toast when the user navigates away      | `aborted` is being shown                            |
| the screen stops updating after a while          | the stream ended and nothing re-opened it — check `onStatusFailure` |
| messages arrive in bursts and some are missing   | a hand-written reader that assumed whole frames     |
| `error.code` is `GRPC_17`                        | a status this package does not name; the server sent it |
| every call answers `UNIMPLEMENTED`               | the path is wrong, or no gRPC-Web proxy is in front |

---

What it is: [README.md](https://github.com/lankajs/lanka/blob/main/plugins/grpc/README.md) · What may not change:
[SKILL.md](https://github.com/lankajs/lanka/blob/main/plugins/grpc/SKILL.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
