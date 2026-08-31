---
name: lanka-http
description: Configure request policy for a lanka application — retry, idempotency keys, timeouts, auth refresh on 401, a CSRF header, and reading a server's error body. Use when setting up HTTP for a lanka app, when requests need retry or a refresh token flow, when the build refuses with an unkeyed-retry error, or when reviewing code that imports `@lankajs/plugin-http`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-http
    version: "0.0.0"
---

# @lankajs/plugin-http

Core sends requests; this decides **how**. `reference.md` beside this file is the
full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Start from a preset — it is the fastest correct setup

```ts
// session in cookies
lanka.use(
	lankaHttp(
		lankaCookieSessionPolicy({
			csrf: { header: "X-CSRF-Token", value: csrfToken },
			auth: { refreshAuth: () => session.refresh() },
		}),
	),
);

// session in a header
lanka.use(lankaHttp(lankaTokenSessionPolicy({ auth: { refreshAuth: () => session.refresh() } })));
```

Both are `lankaSessionDefaults()` plus one section, and the difference is the
only thing that actually differs: **cookies need a CSRF header** (the browser
attaches a cookie to a request from someone else's page by itself, and will not
attach a header); **tokens do not** (nothing attaches a bearer token for you).

A preset returns an ordinary config object, and `overrides` beats every line.

## Retry without idempotency is refused AT BUILD TIME

```
@lankajs/plugin-http: retry without idempotency retries unsafe methods.
Configure idempotency, or narrow retry.methods to safe ones (for example ["GET"]).
```

This is not a lint note. A failure can happen _after_ the server performed the
request — the response was lost, the action happened. An unkeyed retry of an
unsafe method reads as a new intent and creates a second payment, a second
invitation.

Two ways to satisfy it: add `idempotency`, or narrow `retry.methods`.

## The sections

```ts
retry:       { maxAttempts: 3, backoffMs: [200, 500, 1500],
               retryKinds: ["network", "timeout"], retryStatuses: [502, 503, 504] }
idempotency: { header: "Idempotency-Key", methods: lankaUnsafeMethods, generateKey }
timeout:     { defaultTimeoutMs: 15_000, resolveMs: (ctx) => uploadDeadlineFor(ctx) }
auth:        { refreshAuth, shouldSkip: (e) => e.includes("/auth/"), onRefreshFailed }
csrf:        { header, value, methods: lankaUnsafeMethods }
errors:      { extractCode, extractMessage, onRequestFailed }
```

- Retry is by **kind**, not status: `network` and `timeout` may never have
  arrived. `domain` is never retried — the server refused deliberately.
- `resolveMs` exists because an upload and a list read cannot share a deadline.
- `refreshAuth` is a **function, not a URL**: refreshing needs your route, your
  headers and your session storage.
- `onRefreshFailed` fires once per failed refresh, not per waiting request.
- Body readers ship with the plugin: `lankaMessageFromDetail`,
  `lankaMessageFromErrorList`, `lankaMessageFromFieldErrors`,
  `lankaCodeFromErrorCode`, composed with `lankaFirstOf`.

## Order is fixed, and that is deliberate

```
timeout → auth → idempotency → retry → errors
```

The deadline wraps everything; auth sits outside retry (a 401 is not a network
failure, but retrying _after_ a refresh is right); idempotency sits outside retry
or it would mint a new key per attempt — the defect the key exists to prevent.

## Never do these

- **Never enable retry without idempotency** for unsafe methods. The build says
  so; do not work around it.
- **Never omit `shouldSkip` for the refresh route.** A 401 there refreshes, which
  401s, which refreshes.
- **Never parse the error body in a gateway.** A `Response` is read once; a
  handler after this middleware gets a drained stream.
- **Never require the CSRF header on GET.** It breaks link navigation and protects
  against nothing.
- **Never depend on `lanka` normally in a plugin.** It is a peer dependency, or
  the policy installs into an instance nobody uses.

## Symptom → cause

| What you see                           | What it is                                           |
| -------------------------------------- | ---------------------------------------------------- |
| the app throws on start-up about retry | the unkeyed-retry refusal; read it, it says how      |
| duplicated server-side objects         | retry without an idempotency key                     |
| an infinite refresh loop               | no `shouldSkip` for the auth routes                  |
| five sign-in redirects at once         | sign-out wired per request, not to `onRefreshFailed` |
| uploads aborted midway                 | one `defaultTimeoutMs` for everything                |

## More

`reference.md` — the full guide, with every option's default and reason.
