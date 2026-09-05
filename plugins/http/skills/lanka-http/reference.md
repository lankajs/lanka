<!-- Generated from plugins/http/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/plugin-http@2.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/plugin-http`.
>
> Complete code, compiled and run in CI: [plugins/http/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/plugins/http/_playground/playground.test.ts)

# @lankajs/plugin-http — user guide

Request policy: retry, idempotency keys, deadlines, one auth refresh per 401, a
CSRF header, and turning a server's error body into something a screen can branch
on.

Core sends requests. This decides **how**.

## You will learn

- how to get a whole request policy from one preset
- why retry without an idempotency key is refused at build time
- what each section of the config decides, and what its default costs
- why the middleware order is fixed

## When to reach for this

Reach for it as soon as requests need anything beyond being sent: a retry, a
deadline, a refresh on 401, a CSRF header. Core sends requests correctly without
it.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-http
```

`lanka` is a peer dependency: the plugin must plug into the _same_ core instance
you created.

## The fastest correct start

Two presets assemble a whole policy. Pick the one that matches where your session
lives:

```ts
import { lankaHttp, lankaCookieSessionPolicy } from "@lankajs/plugin-http";

lanka.use(
	lankaHttp(
		lankaCookieSessionPolicy({
			csrf: { header: "X-CSRF-Token", value: csrfToken },
			auth: { refreshAuth: () => session.refresh() },
		}),
	),
);
```

```ts
import { lankaHttp, lankaTokenSessionPolicy } from "@lankajs/plugin-http";

lanka.use(
	lankaHttp(
		lankaTokenSessionPolicy({
			auth: { refreshAuth: () => session.refresh() },
		}),
	),
);
```

Both are `lankaSessionDefaults()` plus one section. The difference between them
is the only thing that actually differs:

- **Cookies** need a CSRF header. The browser attaches a cookie to a request from
  someone else's page _by itself_, and will not attach a header — so every unsafe
  method carries a proof the application put there.
- **Tokens** need none. Nothing attaches a bearer token to a request from someone
  else's page, so proving the request came from your app would prove what the
  token already proves.

A preset returns an ordinary config object, and `overrides` beats every line of
it. Nothing is hidden inside the plugin.

## Configuring it yourself

```ts
lanka.use(
    lankaHttp({
        retry: { … },
        idempotency: { … },
        timeout: { … },
        auth: { … },
        csrf: { … },
        errors: { … },
    }),
);
```

### Retry

```ts
retry: {
    maxAttempts: 3,                       // including the first
    backoffMs: [200, 500, 1500],          // growing, not constant
    retryKinds: ["network", "timeout"],   // kinds, not statuses
    retryStatuses: [502, 503, 504],       // none by default
    methods: ["GET"],                     // all by default
}
```

**Kinds, not statuses**, because a network failure and a timeout are retryable by
nature — the request may never have arrived. `domain` is never retried: the
server understood and refused deliberately, so a retry gives the same refusal,
later.

`retryStatuses` is empty by default because for most 5xx a retry doubles the load
on a system already in trouble. 502/503/504 are the sensible set: the server did
not refuse, it could not answer.

The backoff grows because a steady stream of retries against a server that is
down under load sustains that load.

### Retry without idempotency is refused

**At build time, not on the first retry in production.**

```
@lankajs/plugin-http: retry without idempotency retries unsafe methods.
Configure idempotency, or narrow retry.methods to safe ones (for example ["GET"]).
```

Why it is a hard error: a failure can happen _after_ the server performed the
request — the response was lost, the action happened. Retrying an unsafe method
without a key reads as a new intent and creates a second object: a second
payment, a second invitation. Without retry the user sees an error and decides;
with an unkeyed retry they see nothing and there are two.

### Idempotency

```ts
idempotency: {
    header: "Idempotency-Key",   // default
    methods: lankaUnsafeMethods, // default
    generateKey: () => uuid(),   // default
}
```

Never build the key from user text: backends usually restrict the key to a narrow
character set and reject the rest, so the request fails somewhere other than
where the mistake was made.

### Timeouts

```ts
timeout: {
    defaultTimeoutMs: 15_000,
    resolveMs: (ctx) => (ctx.url.includes("/upload") ? 120_000 : undefined),
}
```

A file upload and a list read cannot share one value: a deadline fit for a list
aborts an upload midway, and one fit for an upload makes the user stare at a hung
screen for two minutes. What counts as an upload is _your_ knowledge — by path,
by method, by body type.

Every attempt gets its own full deadline, not what the previous ones left.

### Auth refresh

```ts
auth: {
    refreshAuth: async () => session.refresh(),          // true = retry the request
    shouldSkip: (endpoint) => endpoint.includes("/auth/"), // no refresh loops
    onRefreshFailed: () => session.signOut(),
}
```

A **function**, not an endpoint URL. Refreshing goes through your application
layer, which knows the route, the cookies and headers it needs, and what to do
with the response. A plugin that knew the endpoint would also have to know the
response shape and your session storage — and would stop being a request policy.

`onRefreshFailed` is called **once per failed refresh**, not once per waiting
request. Otherwise five concurrent requests produce five navigations to the
sign-in screen.

### CSRF

```ts
csrf: {
    header: "X-CSRF-Token",
    value: token,
    methods: lankaUnsafeMethods,          // default
    origins: ["https://billing.example"], // beyond the API's and the page's own
}
```

Unsafe methods only. GET and HEAD change nothing, and requiring the header on
them breaks link navigation for imaginary protection.

**Own origins only.** The token is a secret shared with one server. A relative
endpoint, the API's origin and the page's own carry it; an absolute URL to
anywhere else does not, because a file host or a payment provider holding it has
the one thing standing between a live cookie and a forged request. An
application talking to several of its _own_ APIs names them in `origins`.

### What every request carries

```ts
defaults: {
    credentials: "include",
    headers: { Accept: "application/json", "x-client": `web/${version}` },
}
```

**`credentials` is why this section exists.** `fetch` defaults to
`"same-origin"`, so a front end on `app.example.com` talking to an API on
`api.example.com` — the ordinary deployment — sends no cookie at all. A CSRF
header without the cookie it protects proves the request came from your
application and authenticates nobody. `lankaCookieSessionPolicy` sets
`"include"` for you; a same-origin deployment narrows it.

There is nowhere else to say it. Core knows nothing of cookies on purpose — node
and React Native have none — and a gateway writing `credentials: "include"` on
every call writes it fifty times.

**`headers` are the ones true of every request and belonging to no gateway**: an
`Accept`, a client version, a build id, a tenant. A header the CALL set wins,
because it is the more specific statement. A value of `undefined` is skipped
rather than sent as the word.

Pass a **function** for a value that is only true right now — a context flag, a
token rotated mid-session. It is read once per attempt, so a retry after a
refresh carries the new value:

```ts
defaults: { headers: () => ({ "x-trigger": sse.isActive() ? "sse" : "user" }) }
```

### Reading the error body

Core gives you `LankaError { kind: "http" }` with the status, your host's text
and the parsed body. This extracts the part a screen decides on:

```ts
errors: {
    extractCode: (body) => (body as { code?: string }).code,
    extractMessage: lankaFirstOf(
        lankaMessageFromDetail,
        lankaMessageFromErrorList,
        lankaMessageFromFieldErrors,
    ),
    onRequestFailed: ({ status, code, endpoint }) => analytics.track("request_failed", { status, code, endpoint }),
}
```

Four body-shape readers ship with the plugin, plus `lankaFirstOf` to try them in
order and `lankaCodeFromErrorCode` for the common `errorCode` / `error` pair:

| Reader                        | Body shape                     |
| ----------------------------- | ------------------------------ |
| `lankaMessageFromDetail`      | `{ detail: "…" }`              |
| `lankaMessageFromErrorList`   | `{ errors: ["…"] }`            |
| `lankaMessageFromFieldErrors` | `{ errors: { field: ["…"] } }` |
| `lankaCodeFromErrorCode`      | `{ errorCode }` or `{ error }` |

`extractMessage` is always called and beats what core found: core knows one shape
(`message` as a string), you know which shape your backend uses.

`onRequestFailed` is where an application hangs its analytics. One app reports
every failure, another reports none — that is configuration, not a branch inside
the plugin.

## Order is not configurable, and here is why

Registration order is wrapping order, and the plugin fixes it:

```
timeout → auth → idempotency → retry → errors → csrf → defaults
```

- **The deadline wraps everything**: it must apply to a retried attempt and to
  one that followed a refresh.
- **Auth sits outside retry**: a 401 is not a network failure, and retrying it
  without refreshing is pointless — while retrying _after_ a refresh is exactly
  right, which the inner retry does.
- **Idempotency sits outside retry** for a different reason: inside, it would
  mint a new key per attempt — precisely the defect the key exists to prevent.
- **Defaults sit innermost**: they fill what nobody above them filled. Anywhere
  else they would be defaults the layers after them replace, which is not what
  the word means.

## You already have your own transport

Most applications that reach this package have one, because until they did
there was nowhere else to put any of this. Almost all of it moves, and what
moves stops being yours to maintain:

| In your transport                 | Where it goes                                             |
| --------------------------------- | --------------------------------------------------------- |
| prefixing the API base URL        | `host.apiBaseUrl` — core prefixes it in `ALankaGateway`    |
| `JSON.stringify` / `FormData`     | `LankaFetchTransport` reads the body and decides           |
| `credentials: "include"`          | `defaults.credentials`                                     |
| a CSRF header                     | `csrf`                                                     |
| static headers                    | `defaults.headers`                                         |
| refresh-on-401 with a shared lock | `auth` — deduplicated, one retry, `onRefreshFailed` once   |
| retry with backoff                | `retry` — and it retries by kind, not only by status       |
| an idempotency key                | `idempotency` — minted per intent, not per attempt         |
| reading a failure body            | `errors`                                                   |

What does NOT move is anything genuinely yours: a side effect on a particular
domain code, a header only your app can compute. Those are middleware of your
own — `lanka.useRequestMiddleware(...)`, the same seam this plugin uses, six
lines each. They do not need a transport either.

Two things to expect while migrating:

- **Delete the base-URL prefix and set `host.apiBaseUrl` in the same commit.**
  Having both prefixes every path twice, and the first sign is a 404 in the
  field rather than a red test.
- **A hand-rolled handler chain usually cannot retry.** If yours is a fold over
  `(resource, options) => [resource, options]`, it has no `next` — which is why
  the retry ended up somewhere above the gateway, and why the refresh had to
  re-`fetch` by hand. Middleware here is a wrapper, so both come back to where
  they belong.

## Common mistakes

**Enabling retry and wondering why the app will not start.** Read the message: it
is the unkeyed-retry refusal, and it is protecting you from duplicate payments.

**Putting the refresh endpoint in `refreshAuth` without `shouldSkip`.** A 401 on
the refresh route then refreshes, which 401s, which refreshes.

**One timeout for everything.** See `resolveMs`.

**Parsing the error body in a gateway.** A `Response` is read once; a handler
placed after this middleware gets a drained stream. Error shape belongs here.

## Recap

- Start from `lankaCookieSessionPolicy` or `lankaTokenSessionPolicy`; the difference between them is the only thing that actually differs.
- Retry is by **kind**, not status; `domain` is never retried.
- An unkeyed retry of an unsafe method creates a second payment. The plugin refuses that configuration when it is built.
- `refreshAuth` is a function, not a URL, and `onRefreshFailed` fires once per refresh rather than per waiting request.
- Order is fixed: timeout → auth → idempotency → retry → errors → csrf → defaults, and each position has a reason.
- A cookie session must send the cookie: `defaults.credentials`, which the cookie preset sets to `"include"`.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/plugins/http/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/plugins/http/README.md) · Core's request layer:
[../../core/GUIDE.md](https://github.com/lankajs/lanka/blob/main/core/GUIDE.md)
