---
name: lanka-relay
description: Connect separately built lanka applications on one page — each with its own copy of the framework, possibly on different UI frameworks — so they hear each other's scenarios and a late-loading one gets the current state. Use when micro-frontends or independently deployed apps must exchange events or state, when two lanka versions share a page, or when reviewing code that imports `@lankajs/plugin-relay`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-relay
    version: "0.2.0"
---

# @lankajs/plugin-relay

Scenarios between applications that **cannot** share one copy of `lanka`.
`reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## First decide: do they need a relay at all?

| The applications on the page…                                             | Do this                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| are one bundle (a Vite SPA, an Astro page)                                | nothing — one `lanka`, one bus; share a ViewModel or trigger a scenario |
| are built separately but can share one `lanka` (MF singleton, import map) | share it; the same as above                                             |
| each carry their own `lanka` (versions differ, isolated on purpose)       | **this package**                                                        |

A relay between applications that already share one `lanka` adds nothing.

## Use

```ts
// The application that OWNS the state
lankaRelay({ channel: "shop", send: ["cart:changed"], retain: ["cart:changed"] });

// Any other application on the page
lankaRelay({ channel: "shop", receive: ["cart:changed"] });
```

Pass it in `startLanka({ plugins: [...] })` or `lanka.use(...)`. A scenario's
`eventType` is what goes in the lists.

State crosses as its last fact: the sender lists the event in `retain`, and the
receiver's handler asks for it:

```ts
{ scenario: cartChanged, handler: ({ set }) => (d) => set({ count: d.items }), options: { replay: "last" } }
```

Applications in OTHER tabs, iframes or workers are reached by adding a transport
— in every application that must reach them, since a relay never forwards:

```ts
import { createLankaRelayBroadcastChannelTransport } from "@lankajs/plugin-relay";
lankaRelay({
	channel: "shop",
	send: ["cart:changed"],
	transport: createLankaRelayBroadcastChannelTransport(),
});
```

The page is still joined. Payloads crossing a transport are structured-cloned.

A screen that mounts and unmounts resolves its ViewModel in a scope, so leaving
takes it off the bus:

```ts
import { resolveLankaVM } from "lanka/extend";
const scope = lanka.createScope();
const vm = resolveLankaVM(badgeDefinition, { scope });
// on unmount
scope.dispose();
```

## Never do these

- **Never list `"*"` or every event "to be safe".** Each list is a permission;
  name only what the other side needs.
- **Never mutate a received payload.** It is the sender's object, by reference.
- **Never use `instanceof` across applications.** Each copy has its own classes;
  `LankaError.is(error)` works across copies.
- **Never install it on a server.** It throws there, on purpose.
- **Never rely on the relay to bypass a gate.** An event the sender's middleware
  stopped is never repeated.
- **Never send a function or a class instance across a transport.** A function
  is refused (logged, delivered locally only); an instance arrives as a plain object.

## Symptom → cause

| What you see                                     | What it is                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| the other application never hears the event      | named in `send` on one side but not in `receive` on the other        |
| a late-loading app shows 0 until the next change | no `retain` on the sender, or no `replay: "last"` on the handler     |
| handlers fire after the screen closed            | the ViewModel was not resolved in a scope, or the scope not disposed |
| "two copies of lanka" in the console             | expected when the copies are intentional; otherwise share one        |
| `refuses to install on a server`                 | it was reached from server code; relay is for a browser page         |
| a worker or another tab never hears the event    | no `transport` on one side — every application needs its own         |
| a page app does not hear a worker                | it has no transport; relays never forward                            |
| `needs BroadcastChannel`                         | React Native or old Safari; implement `ILankaRelayTransport`         |

## More

`reference.md` — the full guide: the options table, what it will not do, and how
an application leaves the page.
