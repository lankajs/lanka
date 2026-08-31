<!-- Generated from modules/blob-cache/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/blob-cache@1.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/blob-cache`.
>
> Complete code, compiled and run in CI: [modules/blob-cache/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/blob-cache/_playground/playground.test.ts)

# @lankajs/blob-cache — user guide

A persistent cache for binary resources — avatars, thumbnails, any image whose
URL never changes — that serves them **without ever making an `<img>` swap its
`src`**.

That last part is the product. Swapping `src` on a mounted image makes the
browser discard the decoded frame and decode again, and the user sees a flicker.

## You will learn

- why an image cache must never make an `<img>` swap its `src`
- how the storage rung is chosen, and why it is a probe rather than a check
- what the cache refuses to do, and why that is the feature

## When to reach for this

Reach for it when the same immutable images are fetched again on every screen
entry — avatars, thumbnails. Never for a URL whose content can change.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/blob-cache
```

`@lankajs/storage` comes with it: the IndexedDB and Cache Storage adapters live
there.

## Quick start

```ts
import { LankaBlobCachePolicy, setupLankaBlobCacheLifecycle } from "@lankajs/blob-cache";

const imageCache = new LankaBlobCachePolicy();

// once, at startup, before the first screen renders
await imageCache.hydrate();

// in a component
const src = imageCache.getInitialSrc(avatarUrl) ?? avatarUrl;
return <img src={src} alt="" />;

// and tell it to fetch what it did not have, for next time
imageCache.warmCache(avatarUrl);
```

## The no-swap rule

Three consequences, and they explain the whole API:

1. **`getInitialSrc` is synchronous and final for a given URL.** If the blob is
   in memory it mints an object URL on the spot — `createObjectURL` needs no
   await. Otherwise you get the network URL and that is what renders.
2. **Nothing ever upgrades an image that is already on screen.** A blob fetched
   by `warmCache` is stored for the _next_ mount and the next session.
3. **`hydrate()` lifts recent entries into memory at startup**, so after a
   restart the very first render already takes the synchronous path.

## What it may cache

**Only immutable URLs.** The cache never checks freshness and never asks the
server, so it pays off exactly when the key carries a uuid and the response is
`Cache-Control: immutable`. Point it at a mutable URL and it will serve a stale
image forever.

## The fallback chain

The storage rung is chosen once, by a real write-and-read probe:

| Rung              | Why it is there                                    |
| ----------------- | -------------------------------------------------- |
| **IndexedDB**     | the only rung with a real quota and blob support   |
| **Cache Storage** | present in some WebViews where IndexedDB is closed |
| **Memory**        | always works, dies with the session                |

On the memory rung the behaviour is exactly what it was without a cache — so the
degradation is invisible rather than broken.

A **probe**, not capability detection, because iOS private mode exposes
`indexedDB` and then leaves `open()` pending forever. The probe has a deadline
(`probeTimeoutMs`, 1.5 s) for that reason.

A Service Worker is deliberately not in the chain: it would work for a small
share of clients, needs its own build and registration, and risks pinning a stale
version of the app inside a WebView.

**A fourth level is no cache at all.** For CORS-closed hosts the bytes are simply
unreachable — `fetch` rejects and `no-cors` yields an opaque response. Those URLs
go to `<img>` untouched (rendering needs no CORS) and rely on the browser's own
HTTP cache. Caching them requires a same-origin proxy, which is what the
`sameOriginProxy` option is.

`getBackend()` tells you which rung you are on; show it in a debug panel rather
than guessing.

## Budgets

`LANKA_BLOB_CACHE_CONFIG` holds the defaults:

| Setting                                   | Default | Why                                                                                                                                       |
| ----------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `maxTotalBytes`                           | 16 MB   | iOS WebKit grants ~50 MB per origin and can revoke it without warning, so evict yourself rather than let the platform do it destructively |
| `maxEntryBytes`                           | 2 MB    | anything larger is served from the network and never stored                                                                               |
| `probeTimeoutMs`                          | 1500    | see the chain above                                                                                                                       |
| `dbName`, `cacheStorageName`, `dbVersion` | —       | bump the version when the schema changes                                                                                                  |

Override them when you construct the policy. Store names, blocked hosts and
accepted content types are application decisions and belong there.

## Lifecycle

```ts
const stop = setupLankaBlobCacheLifecycle({
	cache: imageCache,
	subscribeToSessionEnd: (handler) => signedOut.subscribe(handler),
});
```

Two duties, both easy to forget and both user-visible:

- **Clear on sign-out.** Cached images are other people's faces. On a shared
  device the next sign-in must not inherit them, so the store is cleared _with_
  the session rather than living to its TTL.
- **Release object URLs on page hide.** Every live object URL pins its blob in
  memory. Revoking on hide stops a long session accumulating blobs; the stored
  bytes stay, and the next resolve mints a URL again.

`subscribeToSessionEnd` is optional, and leaving it out means there is no
sign-out cleanup. That is your decision to make: the package has no opinion about
what counts as a session ending, and one that reached into a locator to subscribe
to your scenario would be guessing.

## Object URLs without exceptions

```ts
import { createObjectUrlSafely, revokeObjectUrlSafely } from "@lankajs/blob-cache";
```

`URL.createObjectURL` is absent in some hardened WebViews and throws for some
inputs in others. These return `null` instead — which matters because both call
sites are in expensive places: an image resolves during **render**, where a throw
is a white screen.

## Testing it

The whole environment is injected:

```ts
const cache = new LankaBlobCachePolicy({
	indexedDb: undefined, // force the next rung
	caches: undefined,
	now: () => 0,
	createObjectUrl: () => "blob:test",
	revokeObjectUrl: () => {},
});
```

So the chain, the eviction and the degradation are all testable without a
browser.

## Common mistakes

**Caching a mutable URL.** There is no freshness check. Ever.

**Calling `hydrate()` after the first screen.** Then the first render takes the
network path and the cache appears not to work.

**Expecting a visible upgrade.** A warmed image appears on the _next_ mount. That
is the no-flicker guarantee, not a bug.

**Skipping the lifecycle.** Without it, one user's avatars survive the next
sign-in on the same device.

## Recap

- `getInitialSrc` is synchronous and final; nothing upgrades an image already on screen.
- `hydrate()` runs before the first render, or the cache appears not to work.
- IndexedDB → Cache Storage → memory, chosen once by a write-and-read probe with a deadline.
- The memory rung behaves exactly like no cache at all — the degradation is invisible rather than broken.
- Wire up the lifecycle: cached images are other people's faces, and sign-out must clear them.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/blob-cache/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/blob-cache/README.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
