# @lankajs/plugin-graphql

## 1.0.0

### Major Changes

- 3331c47: Three more ways a change arrives: a WebSocket, GraphQL subscriptions, a gRPC
  server stream — each shaped the way SSE already was.

    **`lanka`** gains the `lanka/stream` subsystem: the protocol-free half of
    realtime, which every one of the four transports needs and none of them owns.
    `ILankaServerEventTransport` (the port), `ALankaStreamBridge` and
    `createLankaStreamBridge` (a wire event → a scenario, both styles),
    `createLankaStreamTriggerContext` (the "came from outside" marker),
    `ALankaStreamTransport` (dispatch plus the reconnect ladder — a subclass writes
    `open` and `close`) and `lankaStream` (bridges attached, lifetime owned,
    teardown in the order that matters).

    It is in core because that is where both callers already look, and it is shared
    rather than copied because the marker is the piece whose failure is silent.

    **`@lankajs/plugin-websocket`** — `LankaWebSocketTransport` behind the same port
    `lankaSse` takes, so a proxy that strips `text/event-stream` costs one line of
    configuration. Plus the half SSE has not got: `send`, an outbox bounded and
    flushed on open, and a heartbeat that turns a half-open socket into a reconnect.

    **`@lankajs/plugin-graphql`** — `LankaGraphqlRequest`, whose whole reason is
    that GraphQL answers `200 OK` with an `errors` array: it becomes `LankaError`
    with `kind: "domain"`, while a partial result stays a success.
    `ALankaGraphqlGateway` / `createLankaGraphqlGateway` for `query` and `mutate`,
    and `LankaGraphqlSubscriptionTransport` speaking `graphql-transport-ws`.

    **`@lankajs/plugin-grpc`** — gRPC-Web framing, the trailers block, and sixteen
    status codes mapped onto five failure kinds, with the message codec left to
    whatever generated the message types. `ALankaGrpcGateway` for unary calls and
    `LankaGrpcStreamTransport` for a server stream read as named events.

    **`@lankajs/plugin-sse`** publishes exactly the names it always did — its `api/`
    report is byte-identical — and now re-exports the shared half from
    `lanka/stream` instead of declaring its own.

    **`@lankajs/tool-eslint`** — `lanka/layer-style` learns three role keys:
    `stream-bridge` (which accepts the old `sse-bridge` names as the same pair),
    `graphql-gateway` and `grpc-gateway`.

### Patch Changes

- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
    - lanka@1.1.0
