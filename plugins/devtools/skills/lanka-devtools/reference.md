<!-- Generated from plugins/devtools/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/plugin-devtools@2.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/plugin-devtools`.
>
> Complete code, compiled and run in CI: [plugins/devtools/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/plugins/devtools/_playground/playground.test.ts)

# @lankajs/plugin-devtools — user guide

An inspector for the event bus, the logger, the requests on the wire and the
scenario register — plus an on-screen panel — that **accumulates nothing when it
is disabled**.

## You will learn

- what the inspector collects, and from where
- how to find out which middleware stopped an event
- how to see which scenario nobody is listening to
- how to read the panel, and how to feed your own
- why a disabled inspector costs nothing at all

## When to reach for this

Reach for it while debugging an event that seems not to arrive, a request that
seems not to return, or a screen that seems not to react — and when you want a
debug panel of your own fed by real data. It is development-only by design.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-devtools
```

`lanka` is a peer dependency.

## Quick start

```ts
import { lankaDevtools, renderLankaDevtoolsPanel } from "@lankajs/plugin-devtools";

const devtools = lankaDevtools({ exposeAs: "__devtools" });
lanka.use(devtools);

const teardown = renderLankaDevtoolsPanel(devtools.getSnapshot, {
	subscribe: devtools.subscribe,
	onClear: devtools.clear,
});
```

That is the whole setup. In a production build both calls do nothing.

## What it collects

```ts
devtools.getSnapshot();
// {
//   events:    [{ at, eventType, subscribers, outcome, stoppedBy? }],
//   logs:      [{ at, layer, level, message }],
//   requests:  [{ at, endpoint, durationMs, outcome, error? }],
//   scenarios: [{ eventType, subscribers, dispatches }],
//   inFlight:  2,
// }
```

| Source             | How it is collected                                    |
| ------------------ | ------------------------------------------------------ |
| bus events         | bus middleware that always returns `"pass"`            |
| what became of one | a bus **observer**, which cannot decide anything       |
| log lines          | a logger sink                                          |
| requests           | request middleware that times `next` and rethrows      |
| scenarios          | the bus's own registry, merged with what has been seen |
| requests in flight | a subscription to core's in-flight counter             |

### "Why did nothing happen when I dispatched that"

```ts
devtools.getSnapshot().events;
// [{ eventType: "cart:changed", subscribers: 3, outcome: "stopped", stoppedBy: "not signed in" }]
```

`outcome` is `delivered`, `stopped`, `invalid` — refused by the event's own
schema — or `pending`, which means the dispatch was recorded and never finished.
`stoppedBy` carries the reason the middleware gave.

This needs a **bus observer** rather than more middleware, and the reason is
worth knowing: a middleware sees only the chain ahead of itself, and the
inspector's is the first one registered at bootstrap. It can never learn that a
later middleware stopped an event. Before the observer existed this field was
documented and never filled.

`subscribers` is the AUDIENCE, not the recipients: on a stopped event it tells
you how many never heard it.

### "My scenario does not fire"

```ts
devtools.getSnapshot().scenarios;
// [{ eventType: "checkout:blocked", subscribers: 0, dispatches: 12 }]  ← nobody listens
// [{ eventType: "cart:changed",     subscribers: 3, dispatches: 0  }]  ← never fired
```

Both answers are invisible in a list of what happened, which is why the register
is its own list. The panel greys them out.

### "That screen is slow"

```ts
devtools.getSnapshot().requests;
// [{ endpoint: "https://api/cart", durationMs: 812, outcome: "ok" }]
```

The inspector's request middleware is registered when you install the plugin, so
if you install it first it wraps your retry policy rather than sitting inside it:
one row is one call your application made, including whatever it took to
succeed. It rethrows the failure untouched — the inspector observes and does not
decide.

## Off by default outside development

```ts
lankaDevtools(); // enabled = getLankaFlags().isDevelopment
lankaDevtools({ enabled: true }); // for a test that wants to look at what was collected
```

**A disabled inspector accumulates nothing.** It subscribes to nothing, exposes
no global and returns an empty snapshot, so your bundler removes it and
everything behind it. That property has its own test, because it is the whole
reason the package is safe to install.

`renderLankaDevtoolsPanel` returns `undefined` outside development _before doing
any work_, for the same reason — a panel in a production build is not a little
extra code, it is an interface that can appear on a user's screen.

## Bounded by construction

`maxEvents` (100), `maxLogs` (200) and `maxRequests` (100) are ring buffers. An
inspector that accumulates without a limit is a leak with a user interface: it
looks like diagnostics and behaves as slow memory growth, visible only in a long
session.

## It observes and does not decide

The bus middleware always returns `"pass"`, the observer's return value is
ignored, and the request wrapper rethrows what it caught. Anything able to change
what it watches would turn a diagnostic tool into a participant, and _"I disabled
the inspector and it started working"_ would become a sentence somebody says.

## Reading it without the panel

```ts
const stop = devtools.subscribe(() => render(devtools.getSnapshot()));
devtools.clear();
```

`subscribe` fires when something is collected, coalesced to one call per
microtask so a burst of twenty events is not twenty redraws. A disabled inspector
returns a no-op, so you may subscribe unconditionally.

`exposeAs` puts the plugin on `globalThis` under a name of your choosing, in
development only and removed on teardown — so `__devtools.getSnapshot()` works from
the browser console. A name rather than a flag, because what you need to know is
what to type.

## The panel

```ts
const teardown = renderLankaDevtoolsPanel(devtools.getSnapshot, {
	container: document.getElementById("debug") ?? undefined,
	tab: "requests",
	collapsed: false,
	subscribe: devtools.subscribe,
	onClear: devtools.clear,
});
teardown?.();
```

Plain DOM, no dependencies, bottom-right. Four tabs — events, logs, requests,
scenarios — a filter box over the visible rows, **copy** for the whole snapshot
as JSON, **clear**, and a title bar that collapses it.

| Option      | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `container` | where to mount; `document.body` otherwise                      |
| `tab`       | which list to open on; events otherwise                        |
| `collapsed` | start as a title bar                                           |
| `subscribe` | redraw on a change instead of polling — pass `devtools.subscribe` |
| `onClear`   | what the clear button does; absent, there is no clear button   |

**Pass `subscribe`.** Without it the panel falls back to redrawing twice a second,
which is what it did before there was anything to subscribe to: a redraw when
nothing happened, and half a second of staleness when something did. The old
`renderLankaDevtoolsPanel(getSnapshot, container)` call still works and still
polls.

The panel used to be thirty lines showing the last twenty events, and this
package's own notes called growing it a trap. That rule guarded against a view
dependency and a product surface, and what it produced instead was a panel nobody
opened — the logs and the requests were only reachable by writing a debug screen
of your own, which is a project nobody starts while debugging. The guard now sits
where the risk is: no view library, nothing outside development, nothing written
back into the framework.

## Its own source, not someone else's leak

The inspector does **not** read the bus's replay buffer. Doing so would make it
depend on a leak — up to a hundred payloads per event type living for the whole
session. It has its own source, enabled together with it, because collecting
"just in case" is the same defect under another name.

That is also why no payload is kept. The inspector says an event happened, to how
many, and what became of it; what was IN it is in your own log line.

## Teardown

Removing the plugin (or disposing the instance) unsubscribes the counter, removes
the observer, the request middleware, the logger sink and the global, and clears
the collector.

## Common mistakes

**Leaving `enabled: true` in a production config.** The default is the flag for a
reason; an explicit `true` overrides it everywhere.

**Expecting to see events from before the plugin was installed.** Collection
starts at `install`.

**Installing it after your request-policy plugin** and wondering why one call
shows as three. Registered later, it sits INSIDE the retry rather than around it.

**Reading `stoppedBy` on a `pending` row.** Pending means the dispatch never
finished — that is the finding, and there is no reason yet.

## Recap

- Disabled, it subscribes to nothing and returns an empty snapshot — your bundler removes it and everything behind it.
- It observes and never decides: `"pass"`, an ignored return value, and a rethrow.
- `stoppedBy` answers "why did nothing happen when I dispatched that", and needs an observer because a middleware cannot see past itself.
- The scenario register answers "nobody is listening" and "it never fired" — neither is visible in a list of what happened.
- Every list is a ring buffer; an inspector without a bound is a leak with a user interface.
- Pass `subscribe` to the panel: polling was wrong in both directions.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/plugins/devtools/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/plugins/devtools/README.md) · The event bus:
[../../core/GUIDE.md](https://github.com/lankajs/lanka/blob/main/core/GUIDE.md)
