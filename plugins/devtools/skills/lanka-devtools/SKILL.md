---
name: lanka-devtools
description: Inspect a lanka application's event bus, logs and in-flight requests in development. Use when an event seems not to arrive, when you need to see what the bus and the logger did, when adding a debug panel, or when reviewing code that imports `@lankajs/plugin-devtools`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-devtools
    version: "1.0.0"
---

# @lankajs/plugin-devtools

An inspector that **accumulates nothing when it is disabled**. `reference.md`
beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Setup — two lines, and both are no-ops in production

```ts
const devtools = lankaDevtools({ maxEvents: 100, maxLogs: 200 });
lanka.use(devtools);

const teardown = renderLankaDevtoolsPanel(devtools.getSnapshot);
```

Enabled by `getLankaFlags().isDevelopment`. Disabled, it subscribes to nothing
and returns an empty snapshot, so a bundler removes it and everything behind it.
`renderLankaDevtoolsPanel` returns `undefined` before doing any work outside
development.

## What you get

```ts
devtools.getSnapshot();
// { events: [{ at, eventType, subscribers, stoppedBy? }],
//   logs:   [{ at, layer, level, message }],
//   inFlight: 2 }
```

`stoppedBy` names the middleware that stopped an event — the answer to "why did
nothing happen when I dispatched that".

Collection starts at `install`; nothing before it is visible. Both lists are ring
buffers, because an inspector that accumulates without a limit is a leak with a
user interface.

## It observes and does not decide

The bus middleware always returns `"pass"`. If it could stop delivery, disabling
the inspector could change behaviour — and "I turned off the inspector and it
started working" would become a sentence somebody says.

## Your own panel

Read `getSnapshot()` and render it in your own debug screen. The shipped panel is
thirty lines of DOM in the corner, on purpose — the package has no opinion about
what you render your interface with.

## Never do these

- **Never set `enabled: true` in a production config.** The flag is the default
  for a reason; an explicit `true` overrides it everywhere.
- **Never build a product feature on the panel.** It disappears outside
  development by design.
- **Never expect events from before `install`.**
- **Never read the bus's replay buffer** to get "richer" history — that buffer is
  a leak the inspector deliberately does not depend on.

## Symptom → cause

| What you see                        | What it is                                    |
| ----------------------------------- | --------------------------------------------- |
| an empty snapshot                   | the inspector is disabled; that is the design |
| an event dispatched but nothing ran | check `stoppedBy`, and `subscribers: 0`       |
| the panel in a production build     | `enabled: true` left in the config            |
| memory growth in a long dev session | `maxEvents` / `maxLogs` raised too far        |

## More

`reference.md` — the full guide.
