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

10. **The page path is 0.1.0's, and a transport is added beside it.** The
    registry, the endpoint's three members and the envelope are a protocol copies
    that already shipped speak; `lankaRelay.protocol.test.ts` holds this copy to
    the PUBLISHED 0.1.0, installed under an alias. A transport never replaces the
    page: a replacing option would split one channel silently between the
    applications that set it and the ones that did not.

11. **Never forwarded — events or answers.** A relay posts to its transport only
    what its own application delivered: the same `inFlight` guard that stops a
    page echo stops a repost, and a `hello` is answered from `state.retained`
    alone. Answering with another page application's value — one without a
    transport, a 0.1.0 copy — would hand the other realm a value that then never
    updates there. An application that must be heard in another realm installs
    a transport itself.

12. **At most once on a medium.** A frame from THIS REALM — by the `realm` id on
    the registry, which outlives its sender — was delivered by the page already
    and is dropped; so is one at or below the last `seq` heard from its sender.
    Page membership was the first rule, and it goes stale in exactly the window
    an asynchronous medium opens: a sender that dispatched and left in one task.
    Two media carrying one sender at different speeds would need a seen-set, not
    a high-water mark; one transport is what exists.

13. **A frame is untrusted until checked.** `seq` and `at` must be safe
    integers before either touches anything: `at` goes into the clock every copy
    on the page shares, and a string or `Infinity` there breaks 0.1.0 copies that
    never installed a transport.

14. **One clock, and never backwards.** Every stamp heard from a medium moves the
    page's clock past it (a Lamport clock — 0.1.0's increments stay consistent
    with it). A retained answer is taken only if strictly newer than what the
    application shows: a handed-over value weighs its holder's stamp, a live
    delivery outranks every answer. "Exactly once, newest" is a page promise;
    across realms it is "the page's newest at join, then only newer". Live
    events from two realms are ordered by ARRIVAL: two realms writing one type at
    once may each keep the other's value. Frames carry `at`, so a later version
    can order live frames of retained types by stamp without a new field.

15. **The frame grows by optional fields.** `v` changes only for a shape an old
    reader would misread — a reader drops a `v` it does not know, and a tab left
    open on the previous deploy cannot be updated.

16. **A failed install leaves nothing behind.** A transport that throws at
    `subscribe` takes the observer off the bus and the endpoint off the page.

## Tests and coverage

`src/lanka-relay/lankaRelay.test.ts` pins invariants 1–9, and each of 1, 3
(both halves) and 4 was shown red by breaking exactly that mechanism.
`lankaRelay.transport.test.ts` pins 10–16 with frames the test writes as another
realm would, `lankaRelay.protocol.test.ts` pins 10 against the published 0.1.0,
and `lankaRelay.realms.test.ts` runs a real second realm — a worker thread over
`BroadcastChannel`. Twelve mechanisms of the transport — seq, the same-realm
drop, realm over membership, count and stamp validation, the install rollback,
never-backwards, the clock, never-forwarding, page-not-replaced, the addressee,
the holder's stamp — were each broken once and each turned a scene red. The
playground implements the port by hand over a `MessagePort`, shared by two
relays, and goes red with the one-`onmessage` implementation.
`_playground/` is two applications — a shop and a header — with scoped
ViewModels. Separate COPIES, from two real bundles, are
`_playgrounds/micro-frontends`.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99.
