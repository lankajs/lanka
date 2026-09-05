---
name: lanka-blob-cache
description: Cache avatars, thumbnails and other immutable images so they load instantly and never flicker — with @lankajs/blob-cache. Use when images reload on every screen entry, when an `<img>` flickers, when adding an image cache, or when reviewing code that imports `@lankajs/blob-cache`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/blob-cache
    version: "1.0.1"
---

# @lankajs/blob-cache

A persistent binary cache that serves images **without ever making an `<img>` swap
its `src`**. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## The whole API in one screen

```ts
const imageCache = new LankaBlobCachePolicy();
await imageCache.hydrate(); // once at startup, BEFORE the first screen renders

// in a component
const src = imageCache.getInitialSrc(avatarUrl) ?? avatarUrl;
imageCache.warmCache(avatarUrl); // fetches it for NEXT time

setupLankaBlobCacheLifecycle({
	cache: imageCache,
	subscribeToSessionEnd: (handler) => signedOut.subscribe(handler),
});
```

## The three rules that follow from "no swap"

1. `getInitialSrc` is **synchronous and final** for a URL. Blob in memory → an
   object URL minted on the spot; otherwise the network URL.
2. **Nothing upgrades an image already on screen.** A warmed blob is for the next
   mount. This looks like a missing feature and is the feature.
3. `hydrate()` runs before the first render, so cached images take the
   synchronous path from the start.

## Only immutable URLs

The cache never checks freshness and never asks the server. It pays off when the
key carries a uuid and the response is `Cache-Control: immutable`. Point it at a
mutable URL and it serves a stale image forever.

## Where it stores

IndexedDB → Cache Storage → memory, chosen once by a real write-and-read probe
with a deadline (capability detection is not enough: iOS private mode exposes
`indexedDB` and leaves `open()` pending forever). On the memory rung behaviour is
exactly what it was without a cache. `getBackend()` says which rung you got.

A fourth level is no cache at all: CORS-closed hosts go to `<img>` untouched.

## Budgets

16 MB total, 2 MB per entry, 1.5 s probe. Override at construction; store names,
blocked hosts and accepted content types are application decisions.

## Lifecycle is not optional

- **Clear on sign-out** — cached images are other people's faces, and on a shared
  device the next sign-in must not inherit them.
- **Release object URLs on page hide** — each one pins its blob in memory.

## Never do these

- **Never cache a mutable URL.**
- **Never call `hydrate()` after the first screen.** The first render then takes
  the network path and the cache looks broken.
- **Never expect a visible upgrade** of an image already rendered.
- **Never use `URL.createObjectURL` directly** in a render path — use
  `createObjectUrlSafely`, which returns `null` instead of throwing on hardened
  WebViews.
- **Never skip the lifecycle** and rely on TTL for sign-out.

## Symptom → cause

| What you see                      | What it is                                            |
| --------------------------------- | ----------------------------------------------------- |
| images still reload every time    | `hydrate()` not awaited before the first render       |
| a stale avatar that never updates | a mutable URL in an immutable-only cache              |
| memory grows over a long session  | object URLs never released — wire up the lifecycle    |
| `getBackend()` says memory        | the platform refused both persistent rungs; by design |

## Testing

The whole environment is injected — `indexedDb`, `caches`, `now`,
`createObjectUrl`, `revokeObjectUrl` — so the chain and its degradation are
testable without a browser.

## More

`reference.md` — the full guide, with the rung table and every budget's reason.
