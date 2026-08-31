# @lankajs/plugin-sse

**⬡ plugin** · Server-sent events as a source of change

> SSE transport, bridges into scenarios, and a "came from outside" marker for mutations.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
use(plugin) · host.apiBaseUrl
```

## Contents

- `LankaSseTransport` — connection, reconnection with growing backoff, envelope parsing
- `ALankaSseBridge` — the shape of a server-event → scenario bridge
- `createLankaSseTriggerContext` — the "came from outside" marker
- re-export of the guard and coalescer from `@lankajs/async`

## No `EventSource` is not a failure

On an engine without server events the plugin is simply off for the session: every
screen keeps working because the same data arrives through route loaders. The app
updates on navigation instead of instantly. This is a PROMISE the product relies on,
not an implementation detail.

The same principle one rung down: some engines expose the constructor but refuse the
connection (scheme, proxy, strict CSP). There the plugin gives up quietly instead of
entering a reconnect loop — retrying what cannot succeed is a storm.

## The "came from outside" marker

A handler that updates state cannot tell its own change from someone else's: the user
pressed a button and then receives the server event about that button. Without the
marker the screen notifies the user about their own action, and an optimistic update is
rolled back by a "foreign" response that in fact confirms it.

The marker lives on the plugin INSTANCE, not in the module: two framework instances (a
test beside the app) would share a module-level flag, and one instance's handler would
see a marker set by the other.

Concrete bridges do NOT belong here: which events exist is the app's domain.

---

Repository map: [../../README.md](../../README.md)
