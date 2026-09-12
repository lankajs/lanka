# Maintaining `@lankajs/tanstack-query`

`ILankaReadCache` over a `QueryClient`. Eighty lines, three of which carry
knowledge that is wrong silently.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/cache`, `lanka/locator` and `@tanstack/query-core`. Nothing
  else, and **never `@tanstack/react-query`** — `check:runtime` would see React,
  make the entry client-only, and the package would stop running in node.
- It does not own the wire. The loader arrives from a ViewModel, which got it
  from a gateway. A cache that fetched by itself would have replaced a layer.

## Invariants

1. **The client is a required constructor parameter.** Two `QueryClient`s in one
   application disagree on the first mutation, silently, and anything else
   reading this cache — `useQuery` in a component, devtools — must hold the same
   instance. A default would let the second one exist unnoticed.

2. **`invalidate` chooses `refetchType` by SUBSCRIBER COUNT.** `"all"` refetches
   a resource nobody is looking at; `"none"` leaves a watched screen stale.
   Neither is right alone, which is why this class counts its own subscribers.

3. **A subscription filters on `event.type` AND `event.action.type`.** `type`
   alone is true while a query is pending and when it fails, so a ViewModel would
   receive `undefined` and then an error object as if they were data.

4. **An event is matched by `event.query.queryHash`**, never by a hash computed
   here. A locally built hash can agree with itself and disagree with the client,
   and then a screen hears about somebody else's resource.

5. **`retry: false` on every read.** Retrying belongs to the request policy,
   where it travels with an idempotency key. A retry here multiplies that one and
   answers a question nobody asked.

6. **`clear()` tells nobody.** It removes queries rather than resetting them, so
   its events are not `success` and invariant 3's filter drops them — which is
   what the port promises and what the end of a session needs.

## Tests and coverage

The family's shared clauses come from
`@lankajs/tool-testing/lankaReadCacheConformance` and are called from the
playground, where a reader looks for how the package is used. Beside it, only
what THIS library can get wrong — invariants 2, 3, 4 and 6 each have a test that
fails when the line is written the obvious way.

Coverage is a ratchet: statements 99, branches 95, functions 99, lines 99.

## Before you finish

```bash
pnpm --filter @lankajs/tanstack-query test
pnpm --filter @lankajs/tanstack-query test:coverage
node scripts/check-family.mjs
pnpm check
```

`check-family` is the one that matters here: this package and
`@lankajs/nanostores-query` must differ in exactly one word — the vendor's.

## Traps

**Adding an operation the other member cannot implement.** The port is the
family's, not this package's. `readInfinite` is the obvious candidate and the
obvious mistake: TanStack, SWR and Apollo model pagination in three different
ways, so a signature drawn from this one would be a mirror rather than a port.

**Letting `@tanstack/react-query` in through an example.** A doc snippet counts:
`check:llms` reads fenced blocks in the shipped skill.

**Making the client optional "for convenience".** See invariant 1. The bug it
allows is silent and expensive.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
