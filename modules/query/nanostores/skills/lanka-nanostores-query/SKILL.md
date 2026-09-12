---
name: lanka-nanostores-query
description: Put @nanostores/query under a lanka application's ViewModels as a read cache, for an app already using nanostores for its own state. Use when choosing between lanka's cache members, when a nanostores app needs one cache rather than two, when a read cannot be cancelled and that matters, or when reviewing code that imports `@lankajs/nanostores-query`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/nanostores-query
    version: "0.0.0"
---

# @lankajs/nanostores-query

`ILankaReadCache` over `@nanostores/query`. Six of the seven operations, and the
seventh is absent for a reason worth knowing before choosing this member.

## Take the other member unless this applies

**`@lankajs/tanstack-query` is the default answer.** It implements all seven
operations, and an application that has any caching library already has that one.

Take THIS member when the application **already uses nanostores for its own
state**: then it is one cache rather than two, and one subscription model rather
than two.

Install neither where a host framework already has a request cache — Next, React
Router v7, TanStack Start. A second one disagrees with theirs on the first
mutation.

## The operation it does not have

**`cancel` is absent.** `@nanostores/query` declares its fetcher as
`(...keyParts) => Promise<T>`, so no `AbortSignal` reaches your loader. The port
makes the operation optional for exactly this case; a caller writes:

```ts
services.cache.cancel?.(["orders"]);
```

Absent means "the request finishes and its answer is discarded" — wasteful, never
wrong. **A no-op `cancel` would be worse**: the ViewModel would believe the
request stopped.

If cancellation, pagination or devtools matter, take the TanStack member.

## Wiring, once

```ts
const instance = nanoquery();
lanka.locators.singletons.registerInstance("ReadCache", createLankaNanostoresCache(instance));
```

Pass the application's OWN `nanoquery()` — the one the rest of its stores use.
That is the whole reason to choose this member.

## Reading, in a ViewModel

Identical to the other member, which is the point of the family:

```ts
services: () => ({ cache: lankaSingletons.readCache }),

createActions: ({ set, gateways, services }) => ({
	open: async (slug) => {
		set({
			article: await services.cache.read(
				["article", slug],
				(signal) => gateways.articleGateway.bySlug(slug, { signal }),
				{ staleMs: 30_000 },
			),
		});
	},
}),
```

The ViewModel names `ILankaReadCache` from `lanka/cache`, never this package.

## Two things about keys

- **Key parts are strings, numbers and booleans.** This library cannot carry an
  object in a key. Key by the parts: `["orders", status, page]`.
- **It joins the parts with NOTHING.** `["order", 1]` and `["order1"]` are one
  resource here. Put a segment between parts that can run together.

## Never do these

- **Never let a cache event trigger a scenario** — `invalidate → refetch → event
  → announce` has no end.
- **Never cache a mutation.** A save is a ViewModel action through a gateway.
- **Never rely on `cancel` with this member.** Write `cancel?.(…)` and assume the
  request completes.
- **Never hold two caches over one resource.** Mixed members split by RESOURCE,
  with no key in both.

## Testing without a cache

```ts
const cache = createLankaFakeReadCache();
```

From `@lankajs/tool-testing`, checked by the same conformance suite as this
package — with one difference: the fake DOES declare `cancel`, so a ViewModel
written with `cancel?.()` works over both.

## Symptom → cause

| What you see | What it is |
| --- | --- |
| a screen opens already believing somebody edited it | something subscribed with `subscribe` instead of `listen` |
| an invalidation changes nothing | the key was addressed by a guessed separator rather than the store's own |
| a resource refetches when nobody is watching it | a listener attached outside a consumer's subscription |
| a failed read keeps failing | the store was kept after the failure instead of dropped |

## More

`reference.md` — the full guide: mixed use, bringing your own implementation, and
the whole contract a read cache must keep.
