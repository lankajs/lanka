---
name: lanka-grpc
description: Wire gRPC-Web into a lanka application — the framing, the trailers and the status codes, with your own message codec, plus server streams bridged into scenarios. Use when the backend speaks gRPC and the client is a browser or React Native, when grpc-status is being read by hand, or when reviewing code that imports `@lankajs/plugin-grpc`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-grpc
    version: "0.0.0"
---

# @lankajs/plugin-grpc

The part everyone rewrites — framing, trailers, status codes — with the codec
left to whoever generated your message types. `reference.md` beside this file is
the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## The codec is yours

Two functions, and no protobuf dependency in this package:

```ts
const codec: ILankaGrpcCodec<IListTodos, ITodoList> = {
	encode: (message) => toBinary(ListTodosRequestSchema, message),   // protobuf-es
	decode: (bytes) => fromBinary(ListTodosResponseSchema, bytes),
};
```

`createLankaGrpcJsonCodec()` is shipped, for a server speaking `+json` and for
tests where reading the wire beats reading a hex dump. It is **not** the default:
a gRPC server speaks protobuf unless configured otherwise — if you use it, set
`contentType: "application/grpc-web+json"` too.

## A method is a path and a codec

```ts
const LIST: ILankaGrpcMethod<IListTodos, ITodoList> = {
	path: "/todos.v1.Todos/List", // copied from the .proto, not assembled
	codec: listCodec,
};
```

## A gateway

```ts
class TodoGateway extends ALankaGrpcGateway {
	public list(page: number) {
		return this.unary(LIST, { page });
	}
}
```

Or by calling, over the same implementation:

```ts
const todoGateway = createLankaGrpcGateway({
	methods: ({ unary }) => ({ list: (page: number) => unary(LIST, { page }) }),
});
```

## What a status becomes

| Status                      | `kind`    | Because                                    |
| --------------------------- | --------- | ------------------------------------------ |
| `CANCELLED`                 | `aborted` | the user left; **show nothing**            |
| `DEADLINE_EXCEEDED`         | `timeout` | shown, worth another try                   |
| `UNAVAILABLE`               | `network` | a retry is the right offer                 |
| `UNIMPLEMENTED`, `INTERNAL` | `http`    | nobody's doing, and not a refusal          |
| everything else non-zero    | `domain`  | the server reached the handler and said no |
| a real HTTP status          | `http`    | it failed BELOW gRPC — a proxy, a bad route |

`error.code` is the status **name**:

```ts
if (LankaError.is(error) && error.code === "UNAUTHENTICATED") session.signOut();
```

The status is read from the trailers block **and** from the HTTP headers — a call
refused before any message has no body to put it in.

## Server streams

Only streams need `lanka.use()` — a stream is a connection, and a connection
needs a lifetime.

```ts
const watch = createLankaGrpcStreamTransport<IWatchRequest, IChange>({
	path: "/todos.v1.Todos/Watch",
	request: { since: 0 },
	codec: changeCodec,
	eventTypeOf: (change) => (change.kind === "completed" ? "todo.completed" : null),
	payloadOf: (change) => ({ id: change.id }),
});

const grpc = lankaGrpc({
	transport: watch,
	bridges: ({ stream, trigger }) => [todoBridge(stream, trigger)],
});

lanka.use(grpc);
grpc.stream.connect(); // when authenticated — NOT on install
```

`transport` is required here: a stream cannot be built without knowing how its
messages are encoded, and the package must not guess.

**`eventTypeOf` is the whole mapping.** A server stream is one call carrying many
kinds of thing; the application says which named event a message is. Return
`null` to drop one.

An ended stream — cleanly or with a failing status — **re-opens** through the
reconnect ladder. Use `onStatusFailure` to see why it ended; it is reported
rather than thrown because nobody is awaiting a stream.

Split frames are handled for you: a header can arrive across two chunks.

## Mock mode

```ts
this.unary(COMPLETE, { id }, undefined, () => Promise.resolve({ id, done: true }));
```

The mock is answered **before** the wire, so it never touches the codec. A mock
run therefore proves nothing about the `.proto` — that is the one place the mock
path and the real path diverge.

## The "from outside" marker

```ts
if (grpc.trigger.isActive()) {
	/* inside a stream handler */
}
```

The bridge sets it. It is **synchronous** — read it before any `await`.

## What this package is not

No code generation, no `.proto` parsing, no protobuf runtime, and no
bidirectional or client streaming — a browser cannot do either over gRPC-Web.

## Never do these

- **Never use the JSON codec without setting `contentType`.**
- **Never build a `path` out of parts.** Copy it from the `.proto`.
- **Never show an `aborted` failure.** The user left.
- **Never subscribe to the stream directly** from a screen.
- **Never connect on install.**

## Symptom → cause

| What you see                                    | What it is                                              |
| ----------------------------------------------- | ------------------------------------------------------- |
| a `415` from the server                         | the content type does not match the codec               |
| `kind: "schema"`, "carried no message"          | a proxy stripped the body or buffered the trailers      |
| an error toast when the user navigates away     | `aborted` is being shown                                |
| the screen stops updating after a while         | the stream ended — read `onStatusFailure`               |
| messages arrive in bursts, some missing         | a hand-written reader that assumed whole frames         |
| `error.code` is `GRPC_17`                       | a status this package does not name; the server sent it |
| every call answers `UNIMPLEMENTED`              | the path is wrong, or no gRPC-Web proxy is in front     |

## More

`reference.md` — the full guide, including codecs for `protobuf-es` and
`ts-proto`, and bringing your own stream opener.
