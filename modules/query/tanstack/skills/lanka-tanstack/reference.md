<!-- Generated from modules/query/tanstack/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/tanstack-query@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/tanstack-query @tanstack/query-core react zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/query/tanstack/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/query/tanstack/_playground/playground.test.ts)

# @lankajs/tanstack-query — user guide

A read cache under your ViewModels, so two screens reading one resource cost one
request — without any ViewModel learning what TanStack Query is.

## You will learn

- when this package is the right answer, and when installing it is a mistake
- how a ViewModel reads through it, and why the gateway does not change
- what the cache is told after a save, and in what order
- how to test a ViewModel that uses it without installing a cache at all

## When to reach for this

**Only when there is no host cache.** Next, React Router v7 and TanStack Start
each carry a request cache with revalidation. A second one disagrees with theirs
on the first mutation, and your application owns the disagreement.

Reach for this in a plain Vite SPA, where the slot is empty rather than taken and
two screens reading one resource genuinely do send two requests.

> [!WARNING]
> One screen that owns its data needs no cache. The ViewModel's own state is
> already a memory that lives as long as the screen. This package earns its place
> when a resource is READ FROM MORE THAN ONE PLACE.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must be.
> The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/tanstack-query @tanstack/query-core
```

`@tanstack/query-core`, not `@tanstack/react-query`: this package pulls in no
React and runs in the browser, in node and on a device.

## Wiring it, once

```ts
import { QueryClient } from "@tanstack/query-core";
import { createLankaTanstackCache } from "@lankajs/tanstack-query";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

lanka.locators.singletons.registerInstance("ReadCache", createLankaTanstackCache(client));
```

Three things about that call.

**The client is YOURS and is required.** Nothing here invents one. If anything
else in the application reads the same cache — `useQuery` in a component, the
devtools — it has to be this instance. Two clients disagree on the first
mutation, silently.

**`retry: false`.** Retrying belongs to the request policy, where it travels with
an idempotency key ([`@lankajs/plugin-http`](https://github.com/lankajs/lanka/blob/main/plugins/http/GUIDE.md)). A
second retry here multiplies the first.

**`registerInstance`, not `register`.** The locator builds a class with no
arguments, and the client is an argument. That is the point: a default would let
a second client exist without anyone noticing.

## Reading through it

```ts
createLankaVM<IOrdersState, IOrdersActions, IOrderGateways, { cache: ILankaReadCache }>({
	name: "OrdersVM",
	gateways: () => ({ orderGateway }),
	services: () => ({ cache: lankaSingletons.readCache }),
	states: { orders: [] },

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
});
```

**The gateway is unchanged.** It has no memory and no knowledge of a cache; the
ViewModel hands the cache a loader that happens to call it. That is what lets the
same gateway serve a screen with no cache at all, and what keeps the gateway the
layer that can travel to a server.

**The type a ViewModel names is `ILankaReadCache` from `lanka/cache`** — the
framework's, not this package's. Swapping this member for another changes the
line at start-up and nothing else.

**`onInit` is where a screen starts listening**, and `onReset` is where it stops.
That pair is the whole seam: whoever saves writes the cache, and the cache tells
every listener.

## After a save, in this order

```ts
const saved = await gateways.orderGateway.rename(id, name);

set({ server: saved, serverChangedAt: null }); // 1. mark your own write
trigger(orderRenamed, { order: saved });       // 2. announce the fact, with the data
services.cache.write(["order", id], saved);    // 3. tell the cache
void services.cache.invalidate(["orders"]);    // 4. the list it belongs to
```

Step 1 before step 2 so a handler hearing your own save recognises it. And the
cache is told what the server ANSWERED, never what the form held: an input-shaped
object in a cache is a value with no `id` and no `updatedAt`, and it stays there
until something refetches.

> [!IMPORTANT]
> A cache event must never trigger a scenario. `invalidate → refetch → event →
> announce → invalidate` has no end. The bridge runs one way: a scenario may
> invalidate, and a cache change may only write state.

## Testing a ViewModel that uses it

```ts
import { createLankaFakeReadCache } from "@lankajs/tool-testing";

const cache = createLankaFakeReadCache();
const useOrdersVM = createOrdersVM(gateway, cache);
```

The fake keeps every clause this package keeps — it is checked by the same
conformance suite — so a ViewModel tested over it behaves the same in production.
`cache.advance(ms)` makes an answer stale without waiting.

## Bringing your own

`ILankaReadCache` is seven operations, and an application may implement it over
something this repository never heard of. The contract is executable:

```ts
import { lankaReadCacheConformance } from "@lankajs/tool-testing/lankaReadCacheConformance";

lankaReadCacheConformance({ vendor: "my cache", create: () => createMyCache(client) });
```

Twelve of the port's clauses are assertions in that suite; the four it cannot see
— a subscriber must not write the key it observes, the cache is per REQUEST on a
server, one client per application, and the loader always comes from a gateway —
are in the port's own docblock.

## Mixed use

**Supported, not recommended**, the same stance the validator family takes.

| Mixture | What to keep true |
| --- | --- |
| this member AND `@lankajs/nanostores-query` | split by RESOURCE, with no key in both. One key in two caches is a disagreement with no owner |
| the cache under ViewModels AND `useQuery` in components | the same `QueryClient` in both halves, and one `staleTime` per resource. Tell `lanka/gateways-only-in-viewmodels` your query-hooks folder through `allowedDirs` |
| some ViewModels with a cache, some without | nothing — this is ordinary. Only shared resources need one |

## Recap

- Install it only where no host cache exists; otherwise you own a disagreement.
- The client is yours, required, and shared with anything else that reads it.
- The gateway does not change: the cache is a service UNDER the ViewModel.
- Tell the cache what the server answered, after announcing the fact.
- `createLankaFakeReadCache` tests the ViewModel without any cache installed.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/query/tanstack/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/query/tanstack/README.md)
