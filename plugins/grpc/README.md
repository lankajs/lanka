# @lankajs/plugin-grpc

**⬡ plugin** · gRPC-Web: unary calls and server streams

> The framing, the trailers and the status codes — with the message codec left to whoever generated it.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
use(plugin) · host.apiBaseUrl
```

## Contents

- `ILankaGrpcCodec` — the seam: encode a request, decode a response
- `LankaGrpcRequest` — gRPC-Web framing, trailers, `grpc-status` as a tagged failure
- `ALankaGrpcGateway` / `createLankaGrpcGateway` — `unary`, both styles
- `LankaGrpcStreamTransport` — a server stream read as named events

## The package does not know protobuf, and must not

A message codec belongs to whatever generated the message types — `protobuf-es`,
`ts-proto`, a hand-written one. Shipping a runtime for one of them would pick the
consumer's code generator for them and add a dependency to everyone who chose
differently. `ILankaGrpcCodec` is two functions, and `createLankaGrpcJsonCodec()` is the
one this package ships — for a server speaking `+json`, and for a test that wants to
read what went over the wire.

## What is here is the part everyone rewrites

The length-prefixed framing, the trailers frame, and the mapping from `grpc-status` to a
failure the application can branch on. Sixteen status codes become five kinds:
`CANCELLED` is `aborted` and is not shown, `DEADLINE_EXCEEDED` is `timeout`,
`UNAVAILABLE` is `network` and invites a retry, `UNIMPLEMENTED` and `INTERNAL` are
`http`, and everything else is `domain` with the status name as the code. Without the
mapping a cancelled call and a failed one look the same, and the user is shown an error
for leaving the screen.

## `grpc-status` arrives in two places

In the trailers frame at the end of the body, and — for a call that failed before any
message — in the HTTP headers. Both are read, headers first: a trailers-only response
has no body to find them in, and a reader that only knows one of the two reports a
schema failure for what is an ordinary permission denial.

## Streaming needs no second protocol

A server stream is the same framing arriving over time, so `LankaGrpcStreamTransport` is
an `ILankaServerEventTransport` like every other: `eventTypeOf` says which named event a
decoded message is, and a bridge cannot tell it from SSE.

---

Repository map: [../../README.md](../../README.md)
