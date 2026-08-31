# Maintaining `@lankajs/blob-cache`

A persistent binary cache with a three-rung storage chain and one hard rule: an
`<img>` never swaps its `src`. Everything in the package follows from that rule
and from the fact that the code runs in whatever WebView a client embeds.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `@lankajs/storage` for the IndexedDB and Cache Storage adapters. That
  is the one module-to-module dependency in this repository, and it exists
  because the adapters are storage, not caching.
- It subscribes to nothing on its own. The session-end subscription and the cache
  itself are parameters to `setupLankaBlobCacheLifecycle`, because a package that
  reached into a locator for an application's scenario would be guessing what
  "session ended" means here.

## Invariants

1. **`getInitialSrc` is synchronous and final for a URL.** Blob in memory → an
   object URL minted on the spot; otherwise the network URL. Making it async, or
   letting anything upgrade a rendered image, reintroduces exactly the flicker
   this package exists to prevent.

2. **Nothing upgrades an image that is already on screen.** A fetched blob is for
   the next mount. This looks like a missing feature and is the feature.

3. **The rung is chosen by a write-and-read probe with a deadline, not by
   capability detection.** iOS private mode exposes `indexedDB` and then leaves
   `open()` pending forever. Every later operation is guarded anyway, so a
   `QuotaExceededError` mid-session degrades instead of reaching the interface.

4. **Globals are read through `typeof`, inside a `try`.** Some private modes
   throw on the property _access_ to `indexedDB` / `caches`, and `typeof` is the
   only form that cannot. Unavailable becomes `undefined`, which the store reads
   as a missing rung.

5. **The memory rung must behave exactly like no cache at all.** That is what
   makes the degradation invisible: the worst case is the old behaviour, not a
   broken image.

6. **Object-URL helpers cannot throw.** They return `null`. The call sites are a
   render path — where a throw is a white screen — and a ViewModel action.

7. **The cache is for immutable URLs only.** It never checks freshness and never
   asks the server. Any feature that would make it usable on a mutable URL is a
   different package.

8. **Sign-out clears the store.** Cached images are other people's faces; on a
   shared device the next sign-in must not inherit them. TTL is not a substitute.

9. **The environment is injected in full** — `indexedDb`, `caches`, `now`,
   `createObjectUrl`, `revokeObjectUrl`. That is what makes the chain, the
   eviction and the degradation testable without a browser, and it is why no
   global is read anywhere but in `browserEnvironment`.

## Budgets

`LANKA_BLOB_CACHE_CONFIG` carries the numbers and the reason for each:
16 MB total (iOS WebKit grants about fifty per origin and can revoke without
warning, so evict yourself), 2 MB per entry, a 1.5 s probe deadline. Changing one
means changing the reason written beside it.

## Tests and coverage

Beside each unit, plus `_testing/blobCachePolicyHarness.ts` and
`blobCacheTestDoubles.ts` — the shared harness that drives the policy over a
fake environment. Use it rather than writing a second set of doubles.

Coverage is a ratchet: statements 92, branches 89, functions 87, lines 92.

What to pin: each rung being selected, each rung being _skipped_, an entry over
`maxEntryBytes`, eviction revoking the URLs it handed out, and a second
`getInitialSrc` for the same URL returning the same string.

## Before you finish

```bash
pnpm --filter @lankajs/blob-cache test
pnpm --filter @lankajs/blob-cache test:coverage
pnpm check
```

## Traps

**Adding a Service Worker rung.** It was considered and rejected: it works for a
small share of clients, needs its own build and registration, and risks pinning a
stale version of the app inside the WebView.

**Making an image "refresh".** See invariants 1 and 2. If a URL's content can
change, it does not belong in this cache.

**Reading a global outside `browserEnvironment`.** Every such read is a path that
cannot be tested and a WebView that can throw.

**Letting the lifecycle default to something.** No session-end subscription means
no sign-out cleanup, on purpose. A default would guess what a session is.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
