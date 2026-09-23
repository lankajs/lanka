<!-- Generated from plugins/relay/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/plugin-relay@0.1.0`** — this document describes that version.
>
> Install: `npm install @lankajs/plugin-relay`.
>
> Complete code, compiled and run in CI: [plugins/relay/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/plugins/relay/_playground/playground.test.ts)

# @lankajs/plugin-relay — user guide

Two applications on one page, each with its **own copy** of lanka, hearing each
other's scenarios — and handing a late arrival the current state.

## You will learn

- when you need a relay, and when one shared `lanka` already does the job
- how to say what crosses the channel, in which direction
- how an application that loads later still shows the current state

## When to reach for this

Reach for it when two applications on one page **cannot** share one copy of
`lanka`: they are on different versions of the framework, they come from build
pipelines nobody coordinates, or they are kept isolated on purpose and should
still hear each other.

If they can share one copy — one bundle, a Module Federation singleton, an import
map — do that instead and skip this package. One copy is one bus, and every
scenario already reaches every application on the page.
[ARCHITECTURE.md, "Several frameworks in one application"](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md#several-frameworks-in-one-application)
has both arrangements side by side.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-relay
```

`lanka` is a peer dependency. Install it in EVERY application that joins the
channel — each application's bundle carries its own copy, which is the point.

## Quick start

The shop owns the cart, and announces every change:

```ts
import { lankaRelay } from "@lankajs/plugin-relay";

await startLanka({
	plugins: [
		lankaRelay({
			channel: "shop",
			send: ["cart:changed"],
			retain: ["cart:changed"], // a header that loads later still gets the count
		}),
	],
});
```

The header — another application, another build, maybe another framework —
only listens:

```ts
await startLanka({
	plugins: [lankaRelay({ channel: "shop", receive: ["cart:changed"] })],
});

// Its ViewModel handles the scenario like any other, from its own definition:
scenarioHandlers: [
	{
		scenario: cartChanged, // eventType "cart:changed"
		handler:
			({ set }) =>
			(data) =>
				set({ count: data.items }),
		options: { replay: "last" }, // the current count, even if it arrived before this subscribed
	},
];
```

Neither application imports the other. They know each other by one string, the
channel, and by the event types they name.

## What crosses, and in which direction

| Option    | What it means                                                        | Default |
| --------- | -------------------------------------------------------------------- | ------- |
| `channel` | the name both sides use; only endpoints on one name hear each other  | —       |
| `send`    | event types this application's deliveries are repeated for           | `[]`    |
| `receive` | event types this application accepts from the channel                | `[]`    |
| `retain`  | among `send`: event types whose last payload a late arrival is given | `[]`    |

Every list is empty by default, so a relay nobody configured moves nothing.
Sending and receiving are separate permissions: the receiver filters what
arrives itself, whoever else joined the channel.

A scenario IS an event on the bus — name its `eventType` in the lists and it
crosses like any other.

## State, as the last fact about it

Two copies of lanka cannot share a store: each holds its own. What they CAN
share is the last thing that happened to it. An event listed in `retain` is kept,
last value only, by every application that lists it — whether it announced the
event or was handed it — so the state outlives whoever announced it first. An
application that joins the channel later is handed it at once, and ONCE: however
many applications keep it, the newest value on the page is the one it gets.

It arrives at install — before bootstrap, before any ViewModel subscribed — and
waits on the receiver's bus as that event's last value. A handler that asks for
`replay: "last"` gets it, exactly as it would for a local event.

An application can also join the channel LAST — `lanka.use(lankaRelay(...))`
after its screens are mounted, rather than in `startLanka`'s plugins — and the
retained value then lands on a handler that is already listening, with no
`replay` to ask for. Either order is correct; pick the one your ViewModels
suit.

The relay only sets that "keep the last value" rule where the receiver has not
set one of its own. An event the receiver registered with its own `replay`
window keeps it — including `false`, which means a late subscriber is handed
nothing, by the receiver's own choice.

## What it will not do

- **Repeat an event your own middleware stopped.** The relay repeats DELIVERIES:
  an authorisation check or a privacy filter that stops an event on one side
  stops it everywhere.
- **Send an event back.** An application never repeats the delivery it is
  receiving. An answer its handler dispatches while receiving is a new event,
  and does cross.
- **Run on a server.** The global object there is the whole process, so every
  request on a channel would hear every other request's users. `install`
  throws when a server scope is in place.
- **Copy payloads.** Both sides are in one page, and `data` crosses by
  reference: a receiver that mutates it mutates the sender's. Treat payloads as
  read-only. `instanceof` fails across copies — copy A's `LankaError` is not
  copy B's; `LankaError.is(...)` is the check that works.

## When an application leaves the page

`lanka.dispose()` — or the function `lanka.use(...)` returned — takes the
application off the channel. Its screens' ViewModels go with their scope: resolve
them with `resolveLankaVM(definition, { scope })` from `lanka/extend`, and
`scope.dispose()` on unmount takes them off the bus.

## Common mistakes

- **A relay between modules that share one lanka.** Every scenario already
  reaches them; the relay adds a second delivery path to the same bus's
  neighbours and nothing else.
- **Naming the event on one side only.** `send` without the other side's
  `receive` moves nothing, by design.
- **`retain` without `replay` on the handler.** The value waits on the bus; a
  handler that does not ask for the last value never sees it.

## Recap

- One shared `lanka` first; the relay is for applications that cannot share one.
- `send`, `receive` and `retain` are explicit and empty by default.
- Only deliveries cross, never an event a gate stopped, and never back.
- State crosses as its last fact: `retain` on the sender, `replay: "last"` on the
  handler.
- Browser pages only.
