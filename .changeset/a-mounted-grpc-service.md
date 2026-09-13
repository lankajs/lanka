---
"@lankajs/plugin-grpc": patch
---

`basePath` is applied, instead of being accepted and ignored

`ALankaGrpcGateway` took a `basePath`, documented it, and never used it. The
reason it looks correct is the reason it is not: a gRPC method path is absolute
(`/atlas.Missions/List`), the gateway passed it to `request` unchanged, and
`basePath` only prefixes a RELATIVE path.

So an application whose proxy mounts the service under `/grpc` sent every call to
`/atlas.Missions/List` and got whatever else was serving the root — a 404 that
names neither the gateway nor the setting that was supposed to prevent it.

The gateway now joins the two itself, trimming one trailing slash so a `basePath`
written either way produces one path rather than two variants. Making the method
path relative was rejected instead: the absolute path is the wire format, it is
what a `.proto` generates and what a server routes on, and the gateway is not the
layer that gets to reinterpret it.

A gateway with no `basePath` — the ordinary deployment — is unaffected.
