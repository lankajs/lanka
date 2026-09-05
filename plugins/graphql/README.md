# @lankajs/plugin-graphql

**⬡ plugin** · GraphQL: operations, and subscriptions

> A request kind that reads the errors array, a gateway that writes query and mutate, and graphql-ws as a stream.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
use(plugin) · host.apiBaseUrl
```

## Contents

- `LankaGraphqlRequest` — a request kind: one POST, and `errors` read as a tagged failure
- `ALankaGraphqlGateway` / `createLankaGraphqlGateway` — `query` and `mutate`, both styles
- `LankaGraphqlSubscriptionTransport` — the `graphql-ws` protocol as a stream transport
- `lankaGraphql` — the plugin, for subscriptions only

## The one thing this package is really for

**GraphQL answers `200 OK` with an `errors` array.** Through an ordinary JSON request
that is a success carrying a body the screen then has to inspect — so every application
grows the same helper, and the ones that forget show a spinner over a failed mutation.
`LankaGraphqlRequest` turns it into `LankaError` with `kind: "domain"`, which is the kind
the framework already has for a server refusing deliberately and naming the reason.

An `errors` array beside non-null `data` is a PARTIAL result and is not a failure: the
data is returned and the errors are handed to `onPartialErrors`. Refusing it would throw
away a page that rendered because one nullable field did not.

## Two halves, used apart

Operations need no plugin: build a gateway on `ALankaGraphqlGateway`, or hand
`createLankaGraphqlRequest()` to any gateway you already have. `lanka.use(...)` is for
SUBSCRIPTIONS, because a subscription is a connection and a connection needs a lifetime
to belong to.

## No document parsing, ever

A document is a string, and `TypedDocumentNode` from a code generator is accepted by
reading its `loc.source.body`. The package never parses GraphQL: doing so would mean
shipping a parser, and a build-time code generator already knows more about the schema
than a runtime parser can.

## Subscriptions are one operation per event type

`graphql-ws` multiplexes by an id per subscription; this maps each to a named event a
bridge already understands, so a subscription and a server-sent event reach a scenario
through exactly the same code. The socket is opened once and `subscribe` is sent per
type — including again after a reconnect, which the far end has forgotten about.

---

Repository map: [../../README.md](../../README.md)
