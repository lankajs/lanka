# Maintaining `@lankajs/plugin-relay`

Repeats delivered events between framework instances on one page — in
practice, between applications that each carry their own copy of `lanka`.

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, `workspace:^`.
- It meets only other relay endpoints, never another plugin, and core knows
  nothing of it — the one thing it reads from core that core did not have
  before is the payload on a DELIVERED `ILankaEventBusOutcome`, which names no
  plugin.
- It must not grow into a store synchroniser or a transport. State crosses as
  its last fact (`retain`); another realm — an iframe, a second tab — is a
  transport, and would arrive as an optional port, never built in.

## Invariants

1. **It observes deliveries; it never sits in the chain.** An observer on
   `lanka.eventBus`, repeating only `outcome === "delivered"`. A middleware
   would forward what an application's own gate is about to stop.

2. **Nothing crosses unless both sides name it.** `send`, `receive`, `retain`
   default to `[]`. No `"*"`: widening a list type later is additive, narrowing
   one after shipping `"*"` is not.

3. **The sender reaches every peer itself; a peer never repeats what it is
   receiving.** Only the EXACT delivery in flight — event type and payload by
   identity — is held back. A boolean "delivering" flag would swallow an answer
   a handler dispatches while receiving, and the flow would stop at hop two.

4. **The receiver's handlers run against the receiver.** `deliverInto`
   activates the receiving instance and restores the previous one in `finally`.
   Two instances of one copy share one active pointer; without the switch the
   receiver's handlers would reach the sender's gateways.

5. **The envelope carries its version; the registry key does not.**
   `{ v: 1, from, eventType, data, retained? }` under one
   `Symbol.for("lanka.relay")`. A receiver ignores a `v` it does not know. A key
   per version would make two versions miss each other silently.

6. **A retained value is marked, and the receiver keeps it as the last value.**
   It arrives at install, before bootstrap; registering the event on the
   receiver with `replay: "last"` is what lets a ViewModel subscribing later ask
   for it — and only when the receiver declared no `replay` of its own for that
   event, which outranks the relay's default. `retain` is filtered to what is
   also in `send`, and it keeps a value that was RELAYED IN as well as one this
   application announced — the guard against sending back runs after it. So
   several applications may hold one type, and a newcomer is handed it ONCE: by
   the holder whose value is newest on the page's clock (`lankaRelayChannels`),
   never by every holder, and never by an arbitrary one that may be stale.

7. **Browser only.** `install` throws when a scope resolver is installed — the
   global object on a server is the process.

8. **Uninstall leaves the channel and forgets what was retained.** Otherwise one
   test's relay hears the next test's, and a disposed application keeps
   handing out state.

9. **The plugin name carries the channel.** One instance may sit on two
   channels; the plugin registry refuses two plugins of one name.

## Tests and coverage

`src/lanka-relay/lankaRelay.test.ts` pins every invariant above, and each of
1, 3 (both halves) and 4 was shown red by breaking exactly that mechanism.
`_playground/` is two applications — a shop and a header — with scoped
ViewModels. Separate COPIES, from two real bundles, are
`_playgrounds/micro-frontends`.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99.
