# @lankajs/plugin-devtools — user guide

An inspector for the event bus, the logger and the requests in flight — plus a
small on-screen panel — that **accumulates nothing when it is disabled**.

## You will learn

- what the inspector collects, and from where
- why a disabled inspector costs nothing at all

## When to reach for this

Reach for it while debugging an event that seems not to arrive, or when you want
a debug panel of your own fed by real data. It is development-only by design.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-devtools
```

`lanka` is a peer dependency.

## Quick start

```ts
import { lankaDevtools, renderLankaDevtoolsPanel } from "@lankajs/plugin-devtools";

const devtools = lankaDevtools({ maxEvents: 100, maxLogs: 200 });
lanka.use(devtools);

const teardown = renderLankaDevtoolsPanel(devtools.getSnapshot);
```

That is the whole setup. In a production build both calls do nothing.

## What it collects

```ts
devtools.getSnapshot();
// {
//   events: [{ at, eventType, subscribers, stoppedBy? }],
//   logs:   [{ at, layer, level, message }],
//   inFlight: 2,
// }
```

| Source             | How it is collected                         |
| ------------------ | ------------------------------------------- |
| bus events         | bus middleware that always returns `"pass"` |
| log lines          | a logger sink                               |
| requests in flight | a subscription to core's in-flight counter  |

`stoppedBy` tells you which middleware stopped an event — the answer to "why did
nothing happen when I dispatched that".

## Off by default outside development

```ts
lankaDevtools(); // enabled = getLankaFlags().isDevelopment
lankaDevtools({ enabled: true }); // for a test that wants to look at what was collected
```

**A disabled inspector accumulates nothing.** It subscribes to nothing and
returns an empty snapshot, so your bundler removes it and everything behind it.
That property has its own test, because it is the whole reason the package is
safe to install.

`renderLankaDevtoolsPanel` returns `undefined` outside development _before doing
any work_, for the same reason — a panel in a production build is not a little
extra code, it is an interface that can appear on a user's screen.

## Bounded by construction

`maxEvents` (100) and `maxLogs` (200) are ring buffers. An inspector that
accumulates without a limit is a leak with a user interface: it looks like
diagnostics and behaves as slow memory growth, visible only in a long session.

## It observes and does not decide

The bus middleware always returns `"pass"`. Middleware able to stop delivery
would turn a diagnostic tool into a participant, and _"I disabled the inspector
and it started working"_ would become a sentence somebody says.

## The panel

```ts
const teardown = renderLankaDevtoolsPanel(devtools.getSnapshot, container);
teardown?.();
```

Plain DOM, about thirty lines, bottom-right, no dependencies. The package has no
opinion about what you render your interface with, and this is the only place it
renders anything at all — a view-library dependency for it would cost more than
the panel does.

Pass a `container` to put it somewhere else, or read `getSnapshot()` yourself and
render it in your own debug screen.

## Its own source, not someone else's leak

The inspector does **not** read the bus's replay buffer. Doing so would make it
depend on a leak — up to a hundred payloads per event type living for the whole
session. It has its own source, enabled together with it, because collecting
"just in case" is the same defect under another name.

## Teardown

Removing the plugin (or disposing the instance) unsubscribes the counter, removes
the logger sink and clears the collector.

## Common mistakes

**Leaving `enabled: true` in a production config.** The default is the flag for a
reason; an explicit `true` overrides it everywhere.

**Expecting to see events from before the plugin was installed.** Collection
starts at `install`.

**Using the panel as a product feature.** It is thirty lines of debug output, and
it disappears outside development by design.

## Recap

- Disabled, it subscribes to nothing and returns an empty snapshot — your bundler removes it and everything behind it.
- It observes and never decides: the bus middleware always returns `"pass"`.
- `stoppedBy` answers "why did nothing happen when I dispatched that".
- Both lists are ring buffers; an inspector without a bound is a leak with a user interface.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · The event bus:
[../../core/GUIDE.md](../../core/GUIDE.md)
