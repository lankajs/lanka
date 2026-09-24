# @lankajs/plugin-relay

## 0.2.0

### Minor Changes

- 17c2311: Other tabs, iframes and workers. `lankaRelay` takes an optional `transport`, and
  `createLankaRelayBroadcastChannelTransport()` is one over `BroadcastChannel`:

    ```ts
    lankaRelay({
    	channel: "shop",
    	send: ["CART_CHANGED"],
    	transport: createLankaRelayBroadcastChannelTransport(),
    });
    ```

    The transport is ADDED to the page, never put in its place: an application with
    one still hears, and is heard by, every application on its page exactly as before
    — 0.1.0 copies included, which the tests hold to the published 0.1.0. Any other
    medium is `ILankaRelayTransport`: `post` and `subscribe`, taking several
    subscribers and accepting a post as soon as `subscribe` returns.

    Across realms:

    - a relay never forwards: every application that must hear another realm
      installs a transport;
    - payloads are structured-cloned — a function is refused (logged, delivered
      locally only), a class instance arrives as a plain object;
    - each event arrives at most once, including from an application that left
      the page between dispatching and the medium delivering;
    - an application answers a late realm only with what it retains itself;
    - two realms writing one state at once are ordered by arrival — give shared
      state one writer;
    - a late-loading application gets the page's value at once, and another realm's
      answer afterwards only if it is newer — a screen never goes backwards, but may
      change once just after it mounts;
    - `createLankaRelayBroadcastChannelTransport()` throws where there is no
      `BroadcastChannel` (React Native, Safari before 15.4).

## 0.1.0

### Minor Changes

- d663e27: A new package: scenarios between applications on one page that cannot share one
  copy of `lanka`.

    Applications that CAN share one copy — one bundle, a Module Federation
    singleton, an import map — share one bus, and every scenario already reaches
    every one of them. This is for the arrangement that cannot: applications on
    different versions of the framework, from build pipelines nobody coordinates, or
    kept isolated on purpose, possibly on different UI frameworks.

    ```ts
    // The application that owns the state
    lankaRelay({ channel: "shop", send: ["cart:changed"], retain: ["cart:changed"] });

    // Any other application on the page
    lankaRelay({ channel: "shop", receive: ["cart:changed"] });
    ```

    - **Nothing crosses unless both sides name it.** `send`, `receive` and `retain`
      are empty by default.
    - **Only deliveries cross.** An event the sender's own middleware stopped never
      leaves it.
    - **State crosses as its last fact.** An event listed in `retain` is kept — the
      last delivery of it, announced here or relayed in — and handed to an
      application that joins later; a handler asking for `replay: "last"` gets it,
      even when it subscribes after bootstrap. The state outlives whoever announced
      it first, and a newcomer is handed it once — the newest value on the page,
      however many applications keep it.
    - **No loops, and no lost answers.** A delivery is never sent back where it came
      from; an answer a handler dispatches while receiving does cross.
    - **A browser page only.** On a server every request would share one channel, so
      `install` refuses there.

    Proved by `_playgrounds/micro-frontends` across React, Vue, Svelte and Angular
    modules built by Vite and by webpack. `ARCHITECTURE.md`, "Several frameworks in
    one application", sets it beside the one-copy arrangement it is the alternative
    to.
