# @lankajs/plugin-devtools

**⬡ plugin** · Bus and transport inspector

> The data is already collected and shown to nobody.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
LankaLogger sinks · lankaEventBus.addMiddleware · lankaEventBus.addObserver · useRequestMiddleware · inFlight
```

## Contents

- `LankaDevtoolsCollector` — bounded history of events, logs, requests and the scenario register
- `renderLankaDevtoolsPanel` — four tabs, a filter, clear and copy; absent outside development

## A disabled inspector accumulates NOTHING

Its main property, pinned by its own test. Always-on history is a leak with a user
interface: it looks like diagnostics and behaves as slow memory growth, visible only in
a long session.

So the inspector has its OWN source, enabled together with it, and its own known buffer
bound. Outside development it subscribes to nothing and returns an empty snapshot.

## The inspector observes and does not decide

Its bus middleware always answers `"pass"`. Able to stop delivery, a diagnostic tool
would become a participant, and "disabled the inspector, it started working" would
become a possible sentence.

## Why `stoppedBy` needed a sixth extension point

A bus middleware sees only the chain AHEAD of itself, and a diagnostic tool's is the
first one registered — so it could never learn that a later middleware stopped an event.
The field existed and the guide described it; nothing filled it. `lankaEventBus.addObserver`
reports the outcome of a dispatch after the whole chain has run, and cannot decide
anything: a diagnostic tool that could stop an event would make "I disabled the inspector
and it started working" a sentence somebody says.

## The panel is absent from a production build

`renderLankaDevtoolsPanel` returns `undefined` before doing any work, so the consumer's
bundler removes its body and everything it references. A panel in production is not a
little extra code — it is an interface that can appear on a user's screen.

---

Repository map: [../../README.md](../../README.md)
