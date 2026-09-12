---
name: lanka-tanstack-query
description: Put TanStack Query under a lanka application's ViewModels as a read cache, so two screens reading one resource cost one request. Use when a lanka app in a Vite SPA fetches the same resource from more than one screen, when wiring a QueryClient into the locator, when deciding whether an app needs a cache at all, or when reviewing code that imports `@lankajs/tanstack-query`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/tanstack-query
    version: "0.0.0"
---

# @lankajs/tanstack-query

`ILankaReadCache` over a `QueryClient`. The cache sits **under** the ViewModel —
the ViewModel calls it, the screen still reads one hook, and the gateway never
learns it exists.

## Do not install it if the host has one

Next, React Router v7 and TanStack Start each carry a request cache with
revalidation. **A second one disagrees with theirs on the first mutation**, and
the application owns the disagreement. This is for a plain Vite SPA, where the
slot is empty rather than taken.

A screen that owns its data needs no cache either: a ViewModel's state already
lives as long as the screen. The package earns its place when a resource is read
from MORE THAN ONE place.

## Wiring, once

```ts
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
lanka.locators.singletons.registerInstance("ReadCache", createLankaTanstackCache(client));
```

- **The client is yours and required.** Anything else reading this cache —
  `useQuery` in a component, devtools — must hold the SAME instance. Two clients
  disagree on the first mutation, silently.
- **`retry: false`.** Retry belongs to `@lankajs/plugin-http`, where it travels
  with an idempotency key. A second one multiplies it.
- **`registerInstance`, not `register`** — the locator builds a class with no
  arguments, and the client is one.

## Reading, in a ViewModel

```ts
services: () => ({ cache: lankaSingletons.readCache }),

createActions: ({ set, gateways, services }) => ({
	load: async () => {
		set({
			orders: await services.cache.read(
				["orders"],
				(signal) => gateways.orderGateway.list({ signal }),
				{ staleMs: 30_000 },
			),
		});
	},
}),

onInit: ({ set, services }) => services.cache.subscribe(["orders"], (data) => set({ orders: data })),
```

The ViewModel names `ILankaReadCache` from `lanka/cache`, never this package —
which is what makes the member swappable. `onInit` starts listening and `onReset`
stops; the gateway is unchanged and still has no memory.

## After a save, in this order

1. write your own version into state and mark it,
2. `trigger` the fact, **with the data**,
3. `write` the saved object into the cache,
4. `invalidate` the list it belongs to.

Tell the cache what the SERVER answered, never what a form held: an input-shaped
object has no `id` and no `updatedAt` and stays until something refetches.

## Never do these

- **Never let a cache event trigger a scenario.** `invalidate → refetch → event →
  announce` has no end. The bridge runs one way.
- **Never cache a mutation.** Reads are cached; a save is a ViewModel action
  through a gateway, and the cache is told afterwards.
- **Never give the ViewModels one client and a component another.**
- **Never import `@tanstack/react-query` in code that must run on a server.**

## Testing without a cache

```ts
const cache = createLankaFakeReadCache();
```

From `@lankajs/tool-testing`. It keeps every clause this package keeps — the same
conformance suite checks both — and `advance(ms)` makes an answer stale without
waiting.

## Symptom → cause

| What you see | What it is |
| --- | --- |
| a screen shows stale data after another saved | nothing invalidated the key, or the screen never subscribed in `onInit` |
| two requests for one resource | two cache instances, or two different keys for one thing |
| a component and a ViewModel disagree | two `QueryClient`s — they must share one |
| an endless refetch loop | a cache event that triggers a scenario that invalidates |
| a failure arrives as "something went wrong" | something wrapped the loader's error; `LankaError.kind` is lost |

## More

`reference.md` — the full guide: mixed use, bringing your own implementation, and
the whole contract a read cache must keep.
