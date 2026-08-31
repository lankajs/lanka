---
name: lanka-async
description: Fix out-of-order responses, collapse bursts of identical refreshes, poll safely, and start a promise nobody awaits — with @lankajs/async. Use when a screen shows stale data after several refreshes, when one user action causes many identical requests, when adding polling or a realtime refresh, or when reviewing code that imports `@lankajs/async`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/async
    version: "0.0.0"
---

# @lankajs/async

Four independent primitives. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Pick by the problem, not by the name

| The problem                                      | Use                         |
| ------------------------------------------------ | --------------------------- |
| two refreshes in flight and the wrong one wins   | `createLankaLatestGuard`    |
| one action fans out into ten identical refreshes | `createLankaBurstCoalescer` |
| nobody pushes it, so you have to ask repeatedly  | `LankaPolling`              |
| start work and deliberately not await it         | `safeFireAndForget`         |

The first two look alike and are **not** interchangeable: the guard makes a burst
_correct_, the coalescer makes it _cheap_. Realtime screens want both.

## The guard — take the token BEFORE the request

```ts
const guard = createLankaLatestGuard();

const refresh = async () => {
	const token = guard.start(); // before any await
	const next = await gateway.participants();
	if (!guard.isCurrent(token)) return; // a newer request has since started
	set({ participants: next });
};
```

`invalidate()` when a push arrived while you were fetching: what you hold is
newer than anything still on the wire.

## The coalescer — one key per entity

```ts
const coalescer = createLankaBurstCoalescer<string>();
await coalescer.run(`room:${roomId}`, refresh);
```

A burst produces **at most two** requests: the one that started it, and one
afterwards guaranteed to see everything the burst announced. Every caller's
promise settles when the work covering _its_ call finishes.

## Polling — one instance per screen

```ts
const polling = new LankaPolling();
const id = polling.subscribe(refresh, 5000);
// on the way out
polling.clearAll();
```

An execution never overlaps its predecessor: the next interval is armed after the
previous callback settles. A throwing callback is logged and the loop continues.

## Together, which is how they are actually used

```ts
onServerEvent(() => void coalescer.run(`room:${id}`, refresh)); // cost
// inside refresh: guard.start() / guard.isCurrent()             // correctness
const pollId = polling.subscribe(refresh, 15_000); // what nobody pushes
```

## Never do these

- **Never take the token after an await.** Every response then looks current.
- **Never share one coalescer key across entities.** One refresh is silently
  dropped and it looks like a server bug.
- **Never reach for the coalescer to fix ordering.** It reduces requests; it does
  not decide who wins.
- **Never leave polling running when the screen goes.** The timer holds the
  closure around your ViewModel.
- **Never `void promise` to ignore a rejection.** Use `safeFireAndForget`, which
  is loud in development and silent in production.

## Symptom → cause

| What you see                               | What it is                                    |
| ------------------------------------------ | --------------------------------------------- |
| the list shows the state before the change | no guard, and the first response arrived last |
| N requests per user action                 | no coalescer on the event that fans out       |
| requests pile up behind a slow endpoint    | `setInterval` instead of `LankaPolling`       |
| "unhandled rejection" with no call site    | a bare `void promise`                         |

## More

`reference.md` — the full guide, with the reasoning behind leading-plus-trailing
and the diagnostics each primitive exposes.
