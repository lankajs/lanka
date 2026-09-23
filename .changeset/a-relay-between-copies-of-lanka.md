---
"@lankajs/plugin-relay": minor
---

A new package: scenarios between applications on one page that cannot share one
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
- **State crosses as its last fact.** An event listed in `retain` is handed to an
  application that joins later; a handler asking for `replay: "last"` gets it,
  even when it subscribes after bootstrap.
- **No loops, and no lost answers.** A delivery is never sent back where it came
  from; an answer a handler dispatches while receiving does cross.
- **A browser page only.** On a server every request would share one channel, so
  `install` refuses there.

`ARCHITECTURE.md`, "Several frameworks in one application", sets it beside the
one-copy arrangement it is the alternative to.
