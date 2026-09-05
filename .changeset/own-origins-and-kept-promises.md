---
"lanka": minor
"@lankajs/plugin-http": minor
"@lankajs/browser": patch
"@lankajs/plugin-sse": patch
---

Four promises the code did not keep, each pinned by a test that failed before the fix.

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
