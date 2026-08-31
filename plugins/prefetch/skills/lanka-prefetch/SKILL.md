---
name: lanka-prefetch
description: Warm data and route code before the user asks, without slowing down what they are waiting for — with @lankajs/plugin-prefetch. Use when adding hover prefetch, route chunk preloading or start-up data warm-up, when a navigation feels slow, or when reviewing code that imports `@lankajs/plugin-prefetch`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-prefetch
    version: "0.0.0"
---

# @lankajs/plugin-prefetch

Three tiers on a strict ladder. `reference.md` beside this file is the full
guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

```
SSE  >  ordinary request  >  route chunk  >  prefetch
```

| Tier     | Warms       | When                                   |
| -------- | ----------- | -------------------------------------- |
| `intent` | one payload | the user is reaching for a link        |
| `chunk`  | route code  | the app is idle after start-up         |
| `warmup` | likely data | after start-up, once the wire is quiet |

```ts
const prefetch = lankaPrefetch({ intent: { report }, chunk: { report }, warmup: { report } });
lanka.use(prefetch);
```

Pass a `report`. All of this is invisible when it works, so without a sink "is it
working?" has no answer.

## Intent — a buffer, not a cache

Read by a **loader** only, each entry **once**, entries live **seconds**. That is
why there is no invalidation bus: a missed event cannot make a value stale when
the value does not outlive the gesture that ordered it.

```ts
export const todoResource = defineLankaPrefetchResource({
	id: "todo",
	identify: (params) => params.id, // EVERY param that changes the response
	domain: "todos", // the freshness fence
	fetch: (params) => gateway.byId(Number(params.id)), // BARE: no state, no flags
});

// on hover
prefetch.intent.lankaPrefetch(todoResource, { id: "42" });

// in the loader — the fallback is mandatory
const todo = (await prefetch.intent.claim(todoResource, params)) ?? (await gateway.byId(id));
```

A live event invalidates a whole domain:
`prefetch.intent.bumpFence("todos", "sse: todo.completed")`. The fence is compared
**as of sending**, because a response describes the world as the server read it.

`getDiagnostics()` gives `hitRate` (`claimed / prefetched` — whether a trigger
earns its place), `fenced` (a refusal to serve stale data, not a failure) and
`yielded`.

## Chunk — route code while idle

```ts
prefetch.chunk.setSource(lankaRouterChunkSource(routeManifest, { exclude: ["/admin/*"] }));
prefetch.chunk.start();
```

`load` loads **the chunk and nothing else** — deliberately not the router's own
`preloadRoute`, which runs `beforeLoad` and the loader and so produces phantom
screen views, phantom requests and a corrupted funnel.

## Warm-up — likely payloads

```ts
await prefetch.warmup.run([
	{
		key: "notifications",
		order: 1,
		run: () => notificationsVM.load(),
		keptFreshBy: "sse: notification.*",
	},
]);
```

`run` must be **silent** (no loading flag, no error reporting), and
`keptFreshBy` is **required**: a payload nothing refreshes must not be warmed —
warmed and stale is worse than a skeleton, because the user acts on old data.

## Never do these

- **Never let a resource's `fetch` write to a ViewModel.** It will overwrite the
  screen the user is actually on.
- **Never omit a parameter from `identify`.** Two screens claim each other's data.
- **Never claim twice.** Each entry is read once; the second gets `undefined`.
- **Never skip the fallback after `claim`.** It is how the feature stays safe.
- **Never add a queue, a lock or a retry** around prefetch. Any of them lets it
  block something above it on the ladder.
- **Never lengthen the TTL** "to make the buffer more useful". Past seconds it is
  a cache with no invalidation.

## Symptom → cause

| What you see                                 | What it is                                 |
| -------------------------------------------- | ------------------------------------------ |
| the wrong screen's data appears              | `identify` missing a parameter             |
| the screen the user is on flickers or resets | a `fetch` that writes state                |
| navigation is not faster                     | check `hitRate` — the trigger may be wrong |
| phantom analytics events                     | chunks swept through the router's prefetch |
| the app feels slower while warming           | a queue or retry added somewhere           |

## More

`reference.md` — the full guide, with every option, the three counters and the
diagnostics.
