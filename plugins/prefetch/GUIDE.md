# @lankajs/plugin-prefetch — user guide

Three ways to have things ready before the user asks, arranged on a strict
priority ladder so none of them ever slows down what the user is actually waiting
for.

```
SSE  >  ordinary request  >  route chunk  >  prefetch
```

| Tier     | Warms       | When                                               |
| -------- | ----------- | -------------------------------------------------- |
| `intent` | one payload | the user is reaching for a link                    |
| `chunk`  | route code  | the app is idle after start-up                     |
| `warmup` | likely data | after start-up, in batches, once the wire is quiet |

## You will learn

- three tiers on one priority ladder, and what each warms
- why the intent buffer is a buffer and not a cache
- what prefetch must never do, and how it yields

## When to reach for this

Reach for it when navigation is **measurably** slow and you know which payload
is on the critical path. It is three tiers of machinery for a problem many
applications do not have.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-prefetch
```

`lanka` is a peer dependency.

## Setup

```ts
import { lankaPrefetch } from "@lankajs/plugin-prefetch";

const prefetch = lankaPrefetch({
	intent: { ttlMs: 30_000, maxConcurrent: 2, maxBuffered: 8, report },
	chunk: { gapMs: 150, report },
	warmup: { maxConcurrent: 2, report },
});

lanka.use(prefetch);
```

Everything is invisible when it works, so **pass a `report`**. Without a sink,
"is it working?" has no answer.

## Intent prefetch — a buffer, not a cache

This distinction is the whole design:

- only a **loader** reads it, and each entry **exactly once**;
- entries live **seconds**, so there is no invalidation bus and no way to get it
  wrong — a missed event cannot make a value stale, because the value does not
  outlive the gesture that ordered it;
- it writes to **no ViewModel**;
- every claim has a complete fallback: disable the service and `claim` returns
  `undefined` everywhere, and behaviour is exactly what it was.

### Declare a resource

```ts
import { defineLankaPrefetchResource } from "@lankajs/plugin-prefetch";

export const todoResource = defineLankaPrefetchResource({
	id: "todo",
	identify: (params) => params.id, // every param that changes the response
	domain: "todos", // the freshness fence
	ttlMs: 20_000,
	fetch: (params) => gateway.byId(Number(params.id)),
});
```

**`fetch` must be bare.** It must not write to a ViewModel, raise a loading flag,
set an error or send analytics — the user did not open this screen and may never
open it. Filling state belongs to whoever claims the value.

`identify` must include every parameter that changes the response, or two screens
will claim each other's data.

### Warm, then claim

```ts
// on hover / focus / pointer-down
prefetch.intent.lankaPrefetch(todoResource, { id: "42" });

// in the loader for that route
const warmed = await prefetch.intent.claim(todoResource, params);
const todo = warmed ?? (await gateway.byId(Number(params.id)));
```

The fallback is not optional politeness — it is how the feature stays safe.

### Freshness fences

```ts
prefetch.intent.bumpFence("todos", "sse: todo.completed");
```

A live event in a domain makes every older entry of that domain **unusable**: the
claimer fetches for itself and gets the truth after the event. That is the
buffer's whole safety model — it serves only what no event overtook, and when in
doubt serves nothing.

The fence is compared **as of sending**, not as of the response: a response
describes the world as the server read it, so an event at any point after sending
makes it suspect.

Also available: `invalidate(resourceId)` and `clear(reason)`.

### Diagnostics

```ts
prefetch.intent.getDiagnostics();
// { inFlight, buffered, prefetched, claimed, expired, failed, fenced, yielded, hitRate }
```

`hitRate` is `claimed / prefetched` — the number that says whether a trigger
earns its place. `fenced` is not a failure: it is a refusal to serve stale data.
`yielded` counts warm-ups declined because the app was already waiting for
something.

## Chunk preload — route code while idle

```ts
import { lankaRouterChunkSource } from "@lankajs/plugin-prefetch/router";

prefetch.chunk.setSource(lankaRouterChunkSource(routeManifest, { exclude: ["/admin/*"] }));
prefetch.chunk.start();
```

The route manifest is the shape every router already has — a `path`, a `load`,
an optional `priority` — so TanStack Router, React Router and a hand-written map
all fit without being named.

**`load` loads the chunk and nothing else.** Deliberately _not_ the router's own
`preloadRoute`: that runs `beforeLoad` and the loader, which in an application
seed state, send analytics and call the server. Router-level prefetch produces
phantom screen views, phantom requests and a corrupted funnel.

The sweep waits for an idle callback, a visible tab, a quiet wire and no
`saveData`, and pauses between chunks. `pause()` / `resume()` are there for the
moments your app knows are busy; a pause nobody released expires by itself.

Exclude the route the user is already on, and anything behind a permission they
may not have.

## Data warm-up — likely payloads, in batches

```ts
await prefetch.warmup.run([
	{
		key: "notifications",
		order: 1,
		run: () => notificationsVM.load(),
		keptFreshBy: "sse: notification.*",
	},
	{ key: "profile", order: 2, run: () => profileVM.load(), keptFreshBy: "polling 60s" },
]);
```

Two requirements on a task, and both are refusals learned the hard way:

- **`run` must be silent.** No loading flag (a skeleton would flash over a
  readable screen) and no error reporting (nothing on screen could show it). And
  it is not a route loader — warming through one would, for instance, mark
  notifications read that the user never opened.
- **`keptFreshBy` is required.** A payload nothing refreshes must not be warmed
  at all: warmed and stale is strictly worse than a skeleton, because the user
  _acts_ on old data instead of waiting for correct data.

Warm-up yields to chunks too: code is needed before data, because without the
chunk there is no screen to show the data in.

## How yielding works

Prefetch is last on the ladder and yields two ways:

- **By resource.** While someone else's request is on the wire, a warm-up is not
  sent at all — **discarded, not deferred**, because a deferred one arrives after
  the navigation it was meant to serve.
- **By correctness.** A live event always beats a warmed copy, through the
  fences.

What prefetch must never do is _block_ either of them — which is why there is no
queue, no lock and no retry anywhere in this package.

Three counters feed the ladder: core's request counter, this plugin's chunk
counter (a chunk is pulled by a dynamic `import()` and never passes the request
layer), and the intent buffer's own in-flight count, which it subtracts from the
total so it does not see its own traffic as foreign and stop itself.

## Common mistakes

**A `fetch` that writes to a ViewModel.** It will overwrite the screen the user
is actually on.

**An `identify` missing a parameter.** Two screens claim each other's data, and
it looks like a server bug.

**Claiming twice.** Each entry is read once. The second claim gets `undefined` —
which your fallback handles, so it fails quietly and slowly.

**Warming something with no `keptFreshBy`.** The type will not let you, and that
is the point.

**Sweeping chunks through the router's own prefetch.** Phantom analytics, and
requests you cannot explain.

## Recap

- SSE > ordinary request > route chunk > prefetch. Prefetch never blocks anything above it.
- A declined warm-up is discarded, not deferred — a deferred one arrives after the navigation it was meant to serve.
- Entries live seconds and are read once, which is why there is no invalidation bus.
- A resource's `fetch` is bare: no state, no flags, no analytics.
- `keptFreshBy` is required, because warmed and stale is worse than a skeleton.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Repository map: [../../README.md](../../README.md)
