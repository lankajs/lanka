<!-- Generated from modules/async/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/async@1.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/async react zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/async/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/async/_playground/playground.test.ts)

# @lankajs/async — user guide

Four primitives for the async problems a realtime screen actually has: answers
that arrive out of order, bursts that cost more requests than they are worth,
work nobody pushes to you, and a promise nobody awaits.

They are independent. Install the module and import only what you need.

## You will learn

- which of the four primitives answers which problem, and why two of them look alike
- how to keep a burst of events from becoming a burst of requests
- why a late response must be told it lost, and how
- how the three compose in a realtime screen

## When to reach for this

Reach for it when a screen refreshes from events it does not control: a live
list, a room, anything a server pushes to. A screen that loads once and sits
still needs none of it.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/async
```

`lanka` is a normal dependency of this module; you do not need to configure
anything.

## Which one do I want?

| The problem                                              | Use                         |
| -------------------------------------------------------- | --------------------------- |
| Two refreshes are in flight and the wrong one wins       | `createLankaLatestGuard`    |
| One user action fans out into ten identical refreshes    | `createLankaBurstCoalescer` |
| The server will not tell me, so I have to ask repeatedly | `LankaPolling`              |
| I want to start work and not await it                    | `safeFireAndForget`         |

The first two look similar and are not interchangeable: the guard makes a burst
**correct**, the coalescer makes it **cheap**. Realtime screens usually want
both.

## `createLankaLatestGuard` — the last request wins

A burst of events produces several reads of the same thing, and nothing
guarantees the order in which the answers come back. Without a version, a screen
can end up showing the _first_ response because it arrived last — the state
before the change those events announced.

```ts
import { createLankaLatestGuard } from "@lankajs/async";

const guard = createLankaLatestGuard();

const refresh = async () => {
	const token = guard.start(); // take the token BEFORE the request
	const next = await gateway.participants();

	if (!guard.isCurrent(token)) return; // a newer request has since started

	set({ participants: next });
};
```

| Member             | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| `start()`          | Begins a request and issues its token; earlier tokens lose |
| `isCurrent(token)` | May this response write to state?                          |
| `invalidate()`     | Everything in flight loses — what just arrived is fresher  |

`invalidate()` is for the case where a push arrived while you were fetching: what
you have in hand is newer than any answer still on the wire.

**It does not reduce the number of requests.** Every event still goes to the
network and all responses but one are discarded. That is the coalescer's job.

## `createLankaBurstCoalescer` — one request instead of ten

One server action can fan out into one event per participant, and a bridge that
refreshes on each of them turns one user action into one request per participant.
Those wasted round trips compete for the wire with the screen's own data.

```ts
import { createLankaBurstCoalescer } from "@lankajs/async";

const coalescer = createLankaBurstCoalescer<string>();

// a burst of events on "room:42" produces at most TWO requests
await coalescer.run("room:42", refresh);
```

| Member                | Meaning                                                     |
| --------------------- | ----------------------------------------------------------- |
| `run(key, operation)` | Runs the work, collapsing calls made while one is in flight |
| `pendingKeys()`       | Keys in flight — for tests and diagnostics                  |

**Leading plus trailing, not plain deduplication.** Dropping duplicates entirely
would be cheaper and wrong: if every event of the burst arrives while the first
request is in flight, the state would reflect a read made _before_ the last
change. So a burst produces at most two requests — the one that started it, and
one afterwards that is guaranteed to see everything the burst announced.

Every caller gets a promise that settles when the work **covering its call**
finishes, so `await coalescer.run(…)` is meaningful for all of them.

Keys keep different entities apart: refreshing room 42 must not collapse into
refreshing room 43.

## `LankaPolling` — repeating work, held by a screen

```ts
import { LankaPolling } from "@lankajs/async";

const polling = new LankaPolling();

const id = polling.subscribe(refresh, 5000, 0); // every 5s, first run now
polling.unsubscribe(id);
polling.clearAll(); // on the way out of the screen
```

| Member                                             | Meaning                   |
| -------------------------------------------------- | ------------------------- |
| `subscribe(callback, intervalMs, initialDelayMs?)` | Returns a subscription id |
| `unsubscribe(id)`                                  | Stops that one            |
| `clearAll()`                                       | Stops everything          |

`createLankaPolling()` builds the same class for callers who would rather not
write `new`.

**An execution never overlaps its predecessor.** The next interval is armed after
the previous callback settles — which is what a naked `setInterval` cannot
promise over an async callback, and the reason a slow endpoint does not pile up
requests behind itself.

A callback that throws is logged and the loop continues. One failed poll should
not end the polling.

One instance per screen, and clear it on the way out. A subscription outliving
its screen is the leak this API is shaped to make obvious.

## `safeFireAndForget` — start it, do not await it

```ts
import { safeFireAndForget } from "@lankajs/async";

safeFireAndForget(analytics.track("opened"));
```

A bare `void promise` swallows the rejection: nothing listens, and at best an
"unhandled rejection" appears with no call site. This prints the rejection in
development and is silent in production, where a console message costs bundle
size and log noise and tells the user nothing.

## Putting them together

This is what a live list actually looks like:

```ts
const guard = createLankaLatestGuard();
const coalescer = createLankaBurstCoalescer<string>();
const polling = new LankaPolling();

const refresh = async () => {
	const token = guard.start();
	const next = await gateway.participants();
	if (!guard.isCurrent(token)) return;
	set({ participants: next });
};

// a push arrived — coalesce the burst, and let the guard decide who writes
onServerEvent(() => void coalescer.run("room:42", refresh));

// nothing is pushed for this — ask
const pollId = polling.subscribe(refresh, 15_000);
```

The guard decides _which answer may be written_, the coalescer decides _how many
requests a burst produces_, and polling fetches _what nobody pushes_. They solve
three different problems and compose without knowing about each other.

## Common mistakes

**Taking the token after the request.** `guard.start()` must run before you await
anything, or every response looks current.

**Sharing one coalescer key across entities.** Two rooms on one key means one
refresh is silently dropped.

**Forgetting `clearAll()`.** Polling holds a timer, and a timer holds the closure
around your ViewModel.

**Reaching for the coalescer to fix ordering.** It reduces requests; it does not
decide who wins. Use both.

## Recap

- **The guard** decides which answer may write to state; **the coalescer** decides how many requests a burst sends. Different problems, often both.
- Take the token **before** the request, or every response looks current.
- One coalescer key per entity, or one refresh is silently dropped.
- `LankaPolling` never overlaps an execution with its predecessor. Clear it when the screen goes.
- `safeFireAndForget` is loud in development and silent in production; a bare `void promise` is silent in both.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/async/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/async/README.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
