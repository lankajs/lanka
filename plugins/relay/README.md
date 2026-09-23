# @lankajs/plugin-relay

**⬡ plugin** · Scenarios between applications that cannot share one lanka

> Two applications on one page, each with its own copy of the framework, hear each other's scenarios.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
use(plugin) · lankaEventBus.addObserver
```

## Contents

- `lankaRelay` — joins a channel on the page and repeats the listed events to every other endpoint on it

## Reach for one lanka first

Modules that CAN share one copy of `lanka` — one bundle, a Module Federation singleton,
an import map — need none of this: one copy is one bus, and every scenario already
reaches every module. This is for the arrangement that cannot: applications on
different versions of the framework, from pipelines nobody coordinates, or kept
isolated on purpose.

## It repeats DELIVERIES, never dispatches

The relay is an observer, and it repeats an event only when the local chain DELIVERED
it. An event an application's own middleware stopped — an authorisation check, a
privacy filter — never leaves the page's half that stopped it; a relay reading
dispatches instead would route around every gate an application writes.

## Nothing crosses unless it is named, on both sides

`send` and `receive` are two lists, empty by default. Sending and receiving are
different permissions, and a receiver filters inbound itself rather than trusting
whoever else joined the channel.

## The envelope is the contract, and it outlives a major

Endpoints meet on `globalThis[Symbol.for("lanka.relay")]` and hand each other
`{ v: 1, from, eventType, data }`. Two applications on two majors of this package must
still understand each other, so the version is IN the envelope rather than in the key:
a key per version would make two versions miss each other with no error at all.

## A browser page only

On a server the global object is the PROCESS, and every request joining a channel would
hear every other request's users. `install` refuses when a scope resolver is installed.

---

Repository map: [../../README.md](../../README.md)
