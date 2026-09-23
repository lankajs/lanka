---
"@lankajs/plugin-relay": minor
---

Other tabs, iframes and workers. `lankaRelay` takes an optional `transport`, and
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
