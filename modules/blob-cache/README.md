# @lankajs/blob-cache

**▸ module** · Binary resource cache

> IndexedDB → Cache Storage → memory → direct fetch, with a memory budget and quota eviction.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaBlobCacheStore` — the IndexedDB → Cache Storage → memory chain, memory budget, quota eviction
- `LankaBlobCachePolicy` — resolution without an `<img>` src swap, warm-up queue, fallbacks
- `setupLankaBlobCacheLifecycle` — session-end cleanup and object-URL revocation on page hide
- `LankaCacheStorageBlobAdapter` — the second rung of the chain

## What the application must declare

The package caches bytes and refuses to guess whose. Four decisions have no
default that could be right, so each is configuration and each is empty until an
application fills it — spread `LANKA_BLOB_CACHE_CONFIG` and override what you know:

| Decision | Default | Why there is no better default |
| --- | --- | --- |
| `corsBlockedOrigins` | `[]` | a host whose CORS forbids reading the bytes can never be cached, and trying anyway costs a request per render. Which hosts those are is a property of your infrastructure |
| `sameOriginProxy` | `null` | rewriting a third-party URL through your own origin makes it cacheable. Whether you HAVE such a proxy, and at what path, the package cannot know |
| `acceptContentType` | images | a predicate, not a hard-coded `image/`: an app caching PDFs or fonts changes one function instead of forking the store |
| session end | passed in | `setupLankaBlobCacheLifecycle({ cache, subscribeToSessionEnd })` takes both as parameters. What ENDS a session — a sign-out, a token expiry, a tab closing — is the application's answer, and a module that reached for a locator to find it would stop working without the framework |

The sizes and lifetimes (`maxTotalBytes`, `maxEntryBytes`, `maxMemoryBytes`,
`ttlMs`, `evictionRatio`, `hydrateLimit`, `maxConcurrent`) do have defaults that are
right for a phone, and are worth revisiting only with a measurement.

## Safe for content-addressed URLs, and only those

The cache never revalidates: a key carrying a uuid or a hash cannot go stale, so
there is nothing to check. Point it at a URL whose CONTENT can change under the
same name and it will serve the old bytes until the entry expires — which is not a
bug to be fixed but the property that makes the whole thing cheap.

---

Repository map: [../../README.md](../../README.md)
