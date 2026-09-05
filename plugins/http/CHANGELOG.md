# @lankajs/plugin-http

## 2.0.0

### Minor Changes

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

### Patch Changes

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
    - lanka@1.0.0
