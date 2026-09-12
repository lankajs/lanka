<!-- Generated from modules/query/nanostores/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/nanostores-query@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/nanostores-query @nanostores/query nanostores react zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/query/nanostores/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/query/nanostores/_playground/playground.test.ts)

# @lankajs/nanostores-query — user guide

The same read cache under your ViewModels, over `@nanostores/query` — for an
application that already uses nanostores and would rather have one cache than
two.

## You will learn

- why `@lankajs/tanstack-query` is the default answer, and when this one is not
- the one operation this member does not have, and what a caller does about it
- how a ViewModel reads through it, unchanged from the other member
- how to test a ViewModel that uses it without installing a cache at all

## When to reach for this

**Two conditions, and both have to hold.**

First, the same condition as for any member of this family: there is no HOST
cache. Next, React Router v7 and TanStack Start each carry a request cache, and a
second one disagrees with theirs on the first mutation.

Second, the reason to pick this member rather than the recommended one: **the
application already uses nanostores for its own state.** Then this is one cache
rather than two, and one subscription model rather than two.

> [!TIP]
> If neither of those is true, install
> [`@lankajs/tanstack-query`](https://github.com/lankajs/lanka/blob/main/modules/query/tanstack/GUIDE.md). It implements all seven
> operations; this implements six, and the missing one is below.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must be.

## Install

```bash
npm install @lankajs/nanostores-query @nanostores/query nanostores
```

## Wiring it, once

```ts
import { nanoquery } from "@nanostores/query";
import { createLankaNanostoresCache } from "@lankajs/nanostores-query";

// The application's own — the same one its other stores use.
const instance = nanoquery();

lanka.locators.singletons.registerInstance("ReadCache", createLankaNanostoresCache(instance));
```

Passing your own instance is the point of choosing this member: the cache your
ViewModels read through is the cache the rest of your nanostores code already
holds.

## The one it does not have

**`cancel` is absent, and that is honest rather than unfinished.**
`@nanostores/query` declares its fetcher as `(...keyParts) => Promise<T>`, so no
`AbortSignal` ever reaches your loader. There is nothing to abort.

The port makes `cancel` optional for exactly this case, and a caller writes the
optional call:

```ts
onReset: ({ services }) => {
	release?.();
	// Absent here: the request finishes and its answer is discarded.
	services.cache.cancel?.(["orders"]);
},
```

Wasteful, never wrong. A no-op `cancel` would be worse: the ViewModel would
believe the request stopped.

> [!IMPORTANT]
> If you need cancellation — long reads, an expensive endpoint, a screen people
> leave quickly — take the TanStack member instead. So too if you need pagination
> or devtools.

## Reading through it

Identical to the other member, which is the property the family exists for:

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

The ViewModel names `ILankaReadCache` from `lanka/cache` and never this package.
Swapping members changes the line at start-up and nothing else.

## Two things to know about the keys

**Key parts are strings, numbers and booleans.** `TLankaCacheKey` is narrower
than an array of anything for this member's sake: `@nanostores/query` accepts
`string | number | true` as a key part and cannot carry an object. Key by the
parts instead: `["orders", status, page]`.

**This library joins key parts with nothing.** `["order", 1]` and `["order1"]`
are ONE resource to it. If your keys can run together that way, put a segment
between them.

## Testing a ViewModel that uses it

```ts
import { createLankaFakeReadCache } from "@lankajs/tool-testing";

const cache = createLankaFakeReadCache();
```

The fake keeps every clause this member keeps — both are checked by the same
conformance suite — with one difference worth knowing: the fake DOES declare
`cancel`. A ViewModel written with `cancel?.()` works over both.

## Bringing your own

```ts
import { lankaReadCacheConformance } from "@lankajs/tool-testing/lankaReadCacheConformance";

lankaReadCacheConformance({ vendor: "my cache", create: () => createMyCache(client) });
```

Twelve of the port's clauses are assertions there; the four no suite can see are
in the port's docblock in `lanka/cache`.

## Mixed use

**Supported, not recommended.** If an application genuinely needs this member AND
the TanStack one, split by RESOURCE and let no key live in both: one key in two
caches is the "two caches disagree" failure one level down, with no owner.

## Recap

- Take the TanStack member unless the application is already on nanostores.
- Install neither where a host framework already has a request cache.
- `cancel` is absent; write `cache.cancel?.(…)` and the request is discarded.
- Key parts are strings, numbers and booleans, and they join with nothing.
- `createLankaFakeReadCache` tests the ViewModel with no cache installed.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/query/nanostores/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/query/nanostores/README.md)
