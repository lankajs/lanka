# Maintaining `@lankajs/nanostores-query`

`ILankaReadCache` over `@nanostores/query`. Six of the seven operations, and the
seventh is absent on purpose.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/cache`, `lanka/locator` and the two nanostores packages.
  Nothing else.
- It does not own the wire. The loader arrives from a ViewModel, which got it
  from a gateway.

## Invariants

1. **`cancel` is NOT declared.** This library's fetcher is
   `(...keyParts) => Promise<T>`, so no `AbortSignal` reaches the loader and
   there is nothing to abort. The port makes the operation optional for exactly
   this case. Adding a no-op would be worse than the absence: a ViewModel would
   believe the request stopped.

2. **Subscriptions use `listen`, never `subscribe`.** This library's `subscribe`
   calls its listener immediately with the current value, and a ViewModel would
   take that for an event the moment it started listening.

3. **A store is attached to ONLY while a consumer is subscribed.** A nanostores
   store with any listener is mounted, and a mounted store is refetched by
   `invalidateKeys`. Attaching unconditionally would make every key look watched,
   and "asks nobody when nobody is looking" would be false everywhere.

4. **The library is addressed by `store.key`, never by a key built here.** It
   joins key parts with NOTHING: `["order", 1]` is `"order1"`. A guessed
   separator makes `invalidateKeys` a no-op that reports nothing, and the next
   read answers from a cache that was never dropped. The consequence worth
   documenting: `["order", 1]` and `["order1"]` are one resource to this member.

5. **One store per key, kept.** A store per call leaks one per read and gives
   each reader its own request in flight, which is the opposite of what a cache
   is under a ViewModel for.

6. **A failed read DROPS the store.** This library remembers a failure and
   answers the next reader with it from inside the dedupe window. A failure is
   not an answer.

7. **`clear` detaches before it invalidates.** Invalidation wakes a watched
   store, and at the end of a session that wake reaches a screen being torn down
   — with data the next user must not see.

## Tests and coverage

The family's shared clauses come from
`@lankajs/tool-testing/lankaReadCacheConformance` and are called from the
playground. Beside it, only what THIS library can get wrong: every invariant
above except the first has a test that fails when the line is written the obvious
way, and the first has one asserting the absence.

Coverage is a ratchet: statements 96, branches 94, functions 99, lines 96.

## Before you finish

```bash
pnpm --filter @lankajs/nanostores-query test
pnpm --filter @lankajs/nanostores-query test:coverage
node scripts/check-family.mjs
pnpm check
```

## Traps

**Implementing `cancel` to "match" the other member.** Inventing work for
symmetry is worse than the asymmetry — the same rule the validator family states
about its bridges. The asymmetry here is a fact about the LIBRARY.

**Widening `TLankaCacheKey` so an object can be a key.** The port is narrow
because of this member; widening it makes a promise this member cannot keep.

**Reaching for `revalidateKeys` in `clear`.** See invariant 7.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
