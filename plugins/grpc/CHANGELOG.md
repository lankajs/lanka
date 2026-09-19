# @lankajs/plugin-grpc

## 4.0.0

### Patch Changes

- Updated dependencies [4178c0c]
- Updated dependencies [8349d0b]
- Updated dependencies [9ae4f10]
- Updated dependencies [d0e4474]
- Updated dependencies [912c1c1]
- Updated dependencies [efaaf46]
    - lanka@2.0.0

## 3.0.0

### Patch Changes

- 791d2cb: `basePath` is applied, instead of being accepted and ignored

    `ALankaGrpcGateway` took a `basePath`, documented it, and never used it. The
    reason it looks correct is the reason it is not: a gRPC method path is absolute
    (`/atlas.Missions/List`), the gateway passed it to `request` unchanged, and
    `basePath` only prefixes a RELATIVE path.

    So an application whose proxy mounts the service under `/grpc` sent every call to
    `/atlas.Missions/List` and got whatever else was serving the root — a 404 that
    names neither the gateway nor the setting that was supposed to prevent it.

    The gateway now joins the two itself, trimming one trailing slash so a `basePath`
    written either way produces one path rather than two variants. Making the method
    path relative was rejected instead: the absolute path is the wire format, it is
    what a `.proto` generates and what a server routes on, and the gateway is not the
    layer that gets to reinterpret it.

    A gateway with no `basePath` — the ordinary deployment — is unaffected.

- Updated dependencies [937cf2f]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [252a40f]
- Updated dependencies [937cf2f]
- Updated dependencies [0453484]
- Updated dependencies [937cf2f]
    - lanka@1.3.0

## 2.0.0

### Patch Changes

- Updated dependencies [c1896b7]
    - lanka@1.2.0

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
