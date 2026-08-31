# Maintaining `@lankajs/plugin-http`

Request policy as middleware over core's request pipeline: retry, idempotency,
deadlines, auth refresh, CSRF, and error-body reading. Plus two presets that
assemble a whole policy from where the session lives.

This is the package where a wrong default is a duplicate payment, so most of what
follows is about refusals rather than features.

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, always
  `workspace:^` — a normal dependency would give the plugin its own copy of core,
  and it would install its policy into an instance the application never uses.
- It knows nothing about a specific backend. Every backend-shaped decision — the
  error body, the refresh route, what counts as an upload — arrives as a function
  from the application.
- It never touches state, storage or the session. `refreshAuth` is a callback for
  exactly that reason: a plugin that knew the endpoint would also know the
  response shape and the session storage, and would stop being a request policy.

## Invariants

1. **Retry without idempotency is refused at build time.** A failure can happen
   _after_ the server performed the request; an unkeyed retry of an unsafe method
   reads as a new intent and creates a second object. The check is in
   `assertRetryIsSafe` and it throws when the plugin is constructed, not on the
   first retry — a bug that waits for a network failure waits for the worst
   possible moment.

2. **Registration order is wrapping order and is fixed by the plugin.**
   `timeout → auth → idempotency → retry → errors`. Each position carries a
   reason:
    - the deadline wraps everything, so it applies to a retried attempt and to one
      that followed a refresh;
    - auth is outside retry, because a 401 is not a network failure — but retrying
      _after_ a refresh is right, and the inner retry does it;
    - idempotency is outside retry, or it would mint a new key per attempt, which
      is the defect the key exists to prevent.

    Making the order configurable would make all three reasons the caller's
    problem.

3. **Retry is by KIND, with statuses as an addition.** `network` and `timeout`
   are retryable by nature. `domain` is never retried: the server understood and
   refused. `retryStatuses` is empty by default because for most 5xx a retry
   doubles the load on a system already in trouble.

4. **Backoff grows.** A steady stream of retries against a server that is down
   under load sustains that load.

5. **`onRefreshFailed` fires once per failed refresh**, not per waiting request.
   Five concurrent requests must not produce five navigations to sign-in.

6. **CSRF applies to unsafe methods only.** Requiring the header on GET and HEAD
   breaks link navigation in exchange for protection against nothing.

7. **Error-body reading is middleware, not a gateway error handler.** A
   `Response` is read once; a handler placed second gets a drained stream.

8. **The presets are assembly, not policy relocation.** They return an ordinary
   config object and `overrides` is spread last, so a consumer always wins.

## Tests and coverage

Beside each middleware, plus the `_playground/` scene that drives a full policy
against a fake transport.

Coverage is a ratchet: statements 98, branches 92, functions 99, lines 98.

What must stay pinned, because each is an invariant above: the build-time refusal
(and the two ways to satisfy it), the wrapping order under a retry, one key
across all attempts, one `onRefreshFailed` for concurrent 401s, and no CSRF
header on a GET.

## Performance

`lankaHttp.bench.ts`; baseline in `perf/http.perf.md`, in yardsticks.

**A request through a memory transport is mostly `JSON.stringify` and
`response.json()`.** When the plugin's own share is what you are measuring, bench
the same path with the plugin off and report the _difference_. And clear the fake
transport's recorder per iteration — an unbounded `seen` array under fifteen
thousand iterations is what the bench ends up measuring.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-http test
pnpm --filter @lankajs/plugin-http test:coverage
node scripts/check-publishable.mjs   # the peer range
pnpm check
```

## Traps

**Softening the unkeyed-retry refusal to a warning.** A warning in a console
nobody reads is how the duplicate payment ships.

**Adding a body-shape reader that guesses.** The four readers each match one
documented shape; `lankaFirstOf` composes them. A reader that scans for "any
string that looks like a message" turns an unrecognised body into a plausible
wrong message.

**Depending on `lanka` normally instead of as a peer.** `check:publishable`
catches it, and the reason is in the root README: the range must stay
`workspace:^`, because `workspace:*` packs as an exact version and the plugin
then demands the core version it was built against.

**Reaching for `getLankaHost()` inside a middleware.** The instance is handed to
`install`; use it, so two instances in one process do not share configuration.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
