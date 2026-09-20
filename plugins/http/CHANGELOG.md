# @lankajs/plugin-http

## 6.0.0

### Patch Changes

- Updated dependencies [169c5d9]
    - lanka@2.1.0

## 5.0.0

### Patch Changes

- Updated dependencies [4178c0c]
- Updated dependencies [8349d0b]
- Updated dependencies [9ae4f10]
- Updated dependencies [d0e4474]
- Updated dependencies [912c1c1]
- Updated dependencies [efaaf46]
    - lanka@2.0.0

## 4.0.0

### Minor Changes

- 937cf2f: A failure carries the address of the input it belongs to

    `issues` flattens the path into the text — `items.1.qty: only 2 left` — which is
    a banner's shape and useless to a form, which has a place per input and must find
    it. `plugin-http`'s `lankaMessageFromFieldErrors` already said so in its own
    comment: showing them all is a form's job. The canon reached the form's edge and
    stopped there.

    **`ILankaFieldError` is the carrier, and the path is SEGMENTS.** React Hook Form
    spells `items.1.qty`, TanStack Form spells `items[1].qty`, and neither survives a
    round trip through a string — a message may hold a colon, a key may hold a dot.
    An EMPTY path is the value as a whole, which is the form's root and not an input
    named `""`. `code` is what an application translates by.

    `LankaError.fields` and `LankaValidationError`'s third parameter are ADDITIVE;
    `issues` is untouched. `readLankaFieldErrors` answers one frozen empty list
    rather than `undefined`, so a ViewModel writes no branch for "no fields".

    **`@lankajs/plugin-http` reads the other half of a 422.**
    `lankaFieldsFromErrorMap` turns `{ errors: { "items.1.qty": ["only 2 left"] } }`
    into addressed failures and `extractFieldErrors` puts them on `LankaError.fields`.
    Not variants of one reader: a 422 usually deserves both answers at once — a
    banner and a place per input.

    All three extractors are hardened for the same reason: one that throws now
    answers nothing rather than replacing the server's words with the failure of the
    failure report.

### Patch Changes

- Updated dependencies [937cf2f]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [252a40f]
- Updated dependencies [937cf2f]
- Updated dependencies [0453484]
- Updated dependencies [937cf2f]
    - lanka@1.3.0

## 3.0.0

### Patch Changes

- Updated dependencies [c1896b7]
    - lanka@1.2.0

## 2.0.1

### Patch Changes

- `onRefreshFailed` fires once per failed refresh, which is what it always claimed.

    The option documents itself as "Called ONCE per failed refresh, not per request
    that waited for it: otherwise five concurrent requests would produce five
    navigations to the sign-in screen." The refresh PROMISE was shared, so the
    refresh itself ran once — but the callback was invoked from the middleware body,
    which every waiting request reaches for itself. Five concurrent 401s produced
    five sign-outs, which is the sentence the option uses to explain why it does not.

    It survived because both tests covering it sent a single request, and one request
    is the only shape in which "once per refresh" and "once per waiting request"
    agree. The callback now hangs off the shared promise, so the count follows the
    refresh rather than the traffic.

    Second, smaller: what the callback throws is now contained. A handler that
    navigates, reports, or clears a store can fail, and its exception used to replace
    the server's 401 on its way out — the caller lost the failure it could explain
    and got one from the sign-out mechanism, raised three layers from the cause.

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
