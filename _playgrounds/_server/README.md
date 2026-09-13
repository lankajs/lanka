# @lanka-playgrounds/_server

The API the four applications talk to. Node builtins alone: no express, no `ws`,
no graphql, no grpc runtime.

That is not minimalism for its own sake. It is what makes "the applications
actually run" a claim somebody can check in one command, on a machine with
nothing installed, against a server whose whole behaviour is readable in an
afternoon.

## What it serves

| Wire        | Where                                      | What it is for                                             |
| ----------- | ------------------------------------------ | ---------------------------------------------------------- |
| REST        | `/api/missions`, `/api/crew`, `/api/session` | the ordinary case                                          |
| SSE         | `/api/sse/events`                          | a change that arrives from the server                      |
| WebSocket   | `/api/ws/board`                            | traffic both ways, and an outbox to test                   |
| GraphQL     | `POST /api/graphql`                        | `200 OK` with an `errors` array, and a partial result      |
| graphql-ws  | `/api/graphql/stream`                      | `connection_init` → `ack` → `subscribe` → `next`           |
| gRPC-Web    | `/api/grpc/atlas.v1.Board/*`               | length-prefixed frames, trailers, and a trailers-only refusal |

## The routes that exist to FAIL

A retry policy, a deadline, a refresh and a release guard cannot be exercised
against a server that always answers correctly and quickly.

| Route                                 | What it does                                               |
| ------------------------------------- | ---------------------------------------------------------- |
| `/api/unstable?run=&failures=`        | answers `503` a stated number of times, then `200`         |
| `/api/slow?ms=`                       | takes exactly as long as it is asked to                    |
| `/api/build-manifest.json`            | names a build, so a returning visitor's caches can be aged |
| a token, after `callsPerToken` calls  | expires — by a COUNT rather than a clock, so a test reaches the branch on every run |

## Two sessions, two proofs

A caller may arrive with a bearer token or with the cookie the sign-in set. Only
the cookie caller is asked for `x-atlas-csrf`, because only a cookie is attached
by the browser to a request from somebody else's page. A server that demanded the
header from everybody would make the wrong request policy look necessary.

## Running it

```bash
pnpm --filter @lanka-playgrounds/_server start   # http://127.0.0.1:4380/api
```

Through `tsx` rather than bare node: node's own TypeScript support resolves ESM
the way the runtime does, so it wants a file extension on every relative import —
and every package here is written for a bundler's resolution, where they are
omitted.
