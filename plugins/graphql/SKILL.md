# Maintaining `@lankajs/plugin-graphql`

A request kind that reads the `errors` array, a gateway that writes `query` and
`mutate`, and `graphql-ws` as a stream transport. The package never parses
GraphQL.

## Boundary

- A **plugin**: core calls it — but only for SUBSCRIPTIONS. `lanka` is a **peer
  dependency**, always `workspace:^`.
- Operations need no `use()` and no plugin. That asymmetry is the design, not an
  omission: an application on GraphQL without subscriptions imports the gateway
  base and never registers anything.
- The bridge, the "from outside" marker and the plugin's own lifetime are
  [`lanka/stream`](../../core/src/stream/index.ts)'s. Re-exported here for
  one-import convenience, and never forked.
- No dependency on a GraphQL client, a parser or a code generator, and none may
  be added. See invariant 5.

## Invariants

1. **A `200` carrying `errors` with no `data` is `kind: "domain"`.** That is the
   whole reason the package exists: through an ordinary JSON request it is a
   success carrying a body the screen has to inspect, and the ones that forget
   show a spinner over a failed mutation.

2. **A `200` carrying `errors` AND `data` is a SUCCESS.** A partial result means
   a nullable field resolved to `null` and said why while the rest of the page
   resolved. The errors go to `onPartialErrors`; throwing them discards a page
   that rendered.

3. **A body with neither `data` nor `errors` is `kind: "schema"`.** It is not a
   GraphQL answer. Anything softer puts `undefined` into a schema and sends the
   reader looking at their own query.

4. **A non-2xx is `kind: "http"`.** The server never reached the resolvers, so
   what failed is the transport layer and the status says how.

5. **The package never parses GraphQL.** `readLankaGraphqlDocument` reads a
   string, a generator's `loc.source.body`, or a `toString`. Shipping a parser
   would redo at runtime what a build-time generator already did, and add a
   dependency to everyone who does not need it.

6. **A `subscribe` is never sent before `connection_ack`.** A conforming server
   answers `4401`, and the reconnect ladder then loops against a socket that is
   working. `subscribeTo` refuses until the acknowledgement, and the base calls
   it again for every wanted type the moment one arrives.

7. **A handshake that is never acknowledged is a lost link.** Without the
   timeout, a socket that upgrades and says nothing leaves the transport
   connected-but-useless and the ladder never starts.

8. **The handshake goes out synchronously when there is nothing to await.** An
   `await` on nothing still costs a microtask, and that microtask is a window in
   which the socket is open and has said nothing.

9. **`connectionParams` is a FUNCTION.** A token read once at construction is
   the token the application had on the sign-in screen, and every reconnect an
   hour later would present an expired one.

10. **An `error` or `complete` frame releases the subscription id.** Holding a
    dead id makes the next `subscribeTo` a no-op, and the screen is then
    connected, quiet and permanently wrong.

11. **`query` and `mutate` are the same POST, and the docblock says so.** The
    name is the only place a GraphQL call states whether it changes anything —
    not the method, not the path, not a log line. That is what earns the second
    member.

12. **Headers are merged, never replaced.** A caller adding an authorization
    header would otherwise drop the content type, and the server would answer
    `400` about a body it never tried to parse.

## Tests and coverage

Beside each unit, plus the `_playground/` scene: a board that reads over GraphQL
and hears about changes over one, with both gateway styles and both bridge
styles.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99.

What to pin: every row of the success/failure matrix in invariants 1–4, the
handshake order, re-subscription after a reconnect, and a `ping` answered.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-graphql test
pnpm --filter @lankajs/plugin-graphql test:coverage
node scripts/check-parity.mjs        # the gateway: class and factory
node scripts/check-publishable.mjs   # the peer range
pnpm check
```

## Traps

**Adding a cache.** A ViewModel already owns the state a screen reads, and a
second store under it is two places holding one truth. If somebody wants
normalised caching, that is a different tool and it does not belong under a
transport.

**Depending on `graphql` for `print`.** See invariant 5.

**Throwing on a partial result.** See invariant 2. It is the one row of the
matrix that looks like a failure and is not.

**Sending `subscribe` on `onopen`.** See invariant 6.

**Copying the bridge or the marker out of `lanka/stream`.** Two copies of the
marker are two chances to get it wrong once, and its failure is silent.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
