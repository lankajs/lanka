# @lankajs/plugin-http

**⬡ plugin** · Request policy

> Retry, idempotency, CSRF, auth refresh and timeout as transport middleware.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
ALankaRequest → middleware chain (`useRequestMiddleware`), wired through `lanka.use()`
```

## Mapping a server shape is a schema, not an adapter

A backend whose names are not the application's is read by a TRANSFORMING schema —
`v.pipe(..., v.transform(...))` — because the validator returns what the schema produced. One call
reads the wire and builds the domain object, so there is no adapter layer and no
`adapt()` beside `validate()`.

Keep the mapping and the domain check as TWO schemas. The first changes when the
server changes, the second when the application does, and each names its own
context — so a failure says which of the two contracts broke, which is the
difference between calling the backend team and reading your own reducer.

The reverse direction is the same thing: the payload a backend expects back is a
mapping from the domain, not a serialiser. Both are in this package's playground.

## Differences are CONFIGURATION, never a branch

Two apps can need genuinely different request policies — cookie session versus token
session, CSRF or none, retry or none. A plugin expressing one of them as `if (console)`
would only move the fork to another file; this package names no consumer.

## Three rules, each of which cost a defect

**Retry without idempotency is more dangerous than no retry.** A failure can happen
AFTER the server performed the request: the response was lost, the action happened. A
retry without a key reads as a new intent and creates a second object — a payment, an
invitation. So this configuration is rejected AT BUILD TIME, not on the first retry in
production.

**A key is issued once per intent, never per attempt.** Idempotency registers OUTSIDE
retry for exactly this reason: inside, it would mint a new key per attempt — the very
defect the key exists to prevent.

**Auth refresh takes a function, not an endpoint URL.** A plugin that knew the endpoint
would also know the response shape and the session storage, and would stop being a
request policy. One attempt per 401: a second 401 after a successful refresh means
refresh does not work and the loop must break — in production an infinite loop looks
like a hung interface, not like an error.

---

Repository map: [../../README.md](../../README.md)
