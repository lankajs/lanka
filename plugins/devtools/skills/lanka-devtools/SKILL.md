---
name: lanka-devtools
description: Inspect a lanka application's event bus, logs, requests and scenario register in development. Use when an event seems not to arrive, when a scenario seems not to fire, when you need to know which middleware stopped a dispatch or how long a request took, when adding a debug panel, or when reviewing code that imports `@lankajs/plugin-devtools`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-devtools
    version: "3.0.0"
---

# @lankajs/plugin-devtools

An inspector that **accumulates nothing when it is disabled**. `reference.md`
beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Setup — two lines, and both are no-ops in production

```ts
const devtools = lankaDevtools({ exposeAs: "__devtools" });
lanka.use(devtools);

const teardown = renderLankaDevtoolsPanel(devtools.getSnapshot, {
	subscribe: devtools.subscribe,
	onClear: devtools.clear,
});
```

Enabled by `getLankaFlags().isDevelopment`. Disabled, it subscribes to nothing,
exposes no global and returns an empty snapshot, so a bundler removes it and
everything behind it. `renderLankaDevtoolsPanel` returns `undefined` before doing
any work outside development.

**Install it FIRST**, before a request-policy plugin: registered later its
request middleware sits inside the retry rather than around it, and one call your
application made shows up as three rows.

## What you get

```ts
devtools.getSnapshot();
// { events:    [{ at, eventType, subscribers, outcome, stoppedBy? }],
//   logs:      [{ at, layer, level, message }],
//   requests:  [{ at, endpoint, durationMs, outcome, error? }],
//   scenarios: [{ eventType, subscribers, dispatches }],
//   inFlight:  2 }
```

Collection starts at `install`; nothing before it is visible. Every list is a
ring buffer (`maxEvents` 100, `maxLogs` 200, `maxRequests` 100), because an
inspector that accumulates without a limit is a leak with a user interface.

No payload is ever kept. The inspector says an event happened, to how many, and
what became of it; what was IN it belongs in your own log line.

## The three questions it exists for

**"Why did nothing happen when I dispatched that?"** — read `outcome` and
`stoppedBy` on the event row. `outcome` is `delivered`, `stopped`, `invalid`
(refused by the event's own schema) or `pending` (the dispatch never finished).
`subscribers` is the AUDIENCE, so on a stopped event it says how many never heard
it.

**"Why does my scenario not fire?"** — read the `scenarios` register.
`subscribers: 0` means nobody listens; `dispatches: 0` means it was never fired.
Neither is visible in a list of what happened, which is why the register is its
own list. The panel greys both out.

**"Why is this screen slow?"** — read `requests`: which endpoint, how many
milliseconds, and whether it arrived.

## It observes and does not decide

Three attachment points, one rule: the bus middleware always returns `"pass"`,
the bus observer's return value is ignored, and the request wrapper rethrows what
it caught. If any could change what it watches, disabling the inspector could
change behaviour — and "I turned off the inspector and it started working" would
become a sentence somebody says.

## Reading it without the panel

```ts
const stop = devtools.subscribe(() => render(devtools.getSnapshot()));
devtools.clear();
```

`subscribe` fires when something is collected, coalesced to one call per
microtask. A disabled inspector returns a no-op, so subscribe unconditionally.

`exposeAs` puts the plugin on `globalThis` under the name you give it, in
development only, so calling `getSnapshot()` on it works from the browser
console. A name rather than a flag, because what you need to know is what to
type.

## The panel

Four tabs — events, logs, requests, scenarios — a filter over the visible rows,
copy-as-JSON, clear, and a title bar that collapses it. Options: `container`,
`tab`, `collapsed`, `subscribe`, `onClear`.

**Pass `subscribe`.** Without it the panel polls twice a second, which is what it
did before there was anything to subscribe to.

## Never do these

- **Never set `enabled: true` in a production config.** The flag is the default
  for a reason; an explicit `true` overrides it everywhere.
- **Never build a product feature on the panel.** It disappears outside
  development by design.
- **Never expect events from before `install`.**
- **Never read the bus's replay buffer** to get "richer" history — that buffer is
  a leak the inspector deliberately does not depend on.
- **Never read `stoppedBy` on a `pending` row.** Pending means the dispatch never
  finished; that is the finding, and there is no reason yet.

## Symptom → cause

| What you see                        | What it is                                          |
| ----------------------------------- | --------------------------------------------------- |
| an empty snapshot                   | the inspector is disabled; that is the design       |
| an event dispatched but nothing ran | read `outcome` and `stoppedBy`, then `subscribers`  |
| a scenario that never reacts        | `subscribers: 0` in the register — nobody listens   |
| one call showing as three requests  | the inspector was installed after the retry policy  |
| the panel a beat behind             | `subscribe` was not passed, so it is polling        |
| the panel in a production build     | `enabled: true` left in the config                  |
| memory growth in a long dev session | `maxEvents` / `maxLogs` / `maxRequests` raised far  |

## More

`reference.md` — the full guide.
