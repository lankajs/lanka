# @lankajs/plugin-sse

## 2.0.0

### Patch Changes

- 3331c47: Four promises the code did not keep, each pinned by a test that failed before the fix.

    **`lanka`**

    - `IALankaGatewayConfig.validationService` was accepted and read by nothing: a
      gateway handed a test double got the real validator. It is now
      `this.validationService` on `ALankaGateway` and `validationService` in the
      functional context, defaulting to `lankaStandardValidator`.
    - `ILankaScenario.cleanup` is "called when the scenario is removed from the
      registry". It was never called. `unregister` and `clear` — and with them
      `dispose()` — now run it, containing what it throws.
    - `bootstrap()` is idempotent while a bootstrap is still IN FLIGHT: two callers
      arriving before the first plan finished used to run every service twice.
    - The scenario self-registration pool no longer grows by the whole barrel on
      every bootstrap and on every failed locator lookup.

    **`@lankajs/plugin-http`**

    - The CSRF header is sent only to the application's own origins — the API's,
      the page's, and any named in the new `csrf.origins`. A gateway writing the
      whole URL of a third party used to carry the token there.

    **`@lankajs/browser`**

    - `lankaCookies.set` over the Cookie Store API turned a `Date` expiry into a
      timestamp and then multiplied that timestamp as a number of days.
    - A foreign cookie with a stray `%` in its value no longer makes every
      `get`, `getAll` and `watch` throw `URIError`.

    **`@lankajs/plugin-sse`**

    - Subscribing again to an event type that was dropped no longer attaches a
      second listener to the same connection, so handlers stop firing twice.

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

- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
    - lanka@1.1.0

## 1.0.0

### Major Changes

- The first release: nineteen packages, one framework.

    `lanka` is the core — bootstrap, config, role, locator, gateway, validation,
    mock, errors, scenario, viewmodel and logger. Nine `@lankajs/*` modules an
    application installs one at a time, five plugins that occupy a declared extension
    point, and four tools that run before runtime: the `@lanka_di` alias for six
    bundlers, the boundary lint rules, the test kit and the skill installer.

    The one rule everything follows from is checked rather than agreed: imports go
    one way, and `@lankajs/tool-eslint` names the file and the line when they do not.
    What every package promises is written down in `api/`, and from this version a
    name there is kept until a major.

    `1.0.0` rather than `0.1.0` says the five extension points have settled: request
    middleware, the in-flight counter, bus middleware, logger sinks, and `use()`
    itself. Three plugins occupy them between them, which is what made the shapes
    answerable rather than imagined.

### Patch Changes

- Updated dependencies
    - @lankajs/async@1.0.0
    - lanka@1.0.0
