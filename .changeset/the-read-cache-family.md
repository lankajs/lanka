---
"@lankajs/tanstack-query": major
"@lankajs/nanostores-query": major
"lanka": minor
"@lankajs/tool-testing": minor
---

The read-cache family: a port in core, a suite that can fail, and the two libraries that can bind it

`lanka/cache` publishes `ILankaReadCache` and no cache. A host framework carries
a request cache and its revalidation, so the framework ships none — two of them
disagree on the first mutation. Where there is no host, a plain Vite SPA, the
slot is EMPTY rather than taken: two screens reading one resource send two
requests and grow two independently ageing copies. Core declares the shape and
calls it from nowhere.

**The port's docblock is the contract**, because behaviour is where two honest
implementations diverge and signatures are not. Twelve clauses; four of them
cannot be checked from inside an implementation and are stated for whoever wires
one. The two that cost the most to discover: `subscribe` must NOT deliver the
current value, and `invalidate` must refetch only while somebody is listening.

**`@lankajs/tool-testing/lankaReadCacheConformance`** makes that executable. The
scenes are DATA, so the suite's own spec points each one at a deliberately broken
cache and asserts it is REFUSED — a suite that only ever passes real
implementations proves that it agrees with them, not that it checks them. An
application binding a cache this repository never heard of runs the same list.

**`@lankajs/tanstack-query`** is the recommended member and implements all seven
operations. Three of its lines carry knowledge that is wrong silently, and each
has a test that fails when written the obvious way: `refetchType` chosen by
subscriber count, `event.query.queryHash` rather than a locally built one, and
filtering on `event.action.type` as well as `event.type`.

**`@lankajs/nanostores-query`** implements six and declares no `cancel`, because
`@nanostores/query` hands its fetcher only key parts and no signal. **That is why
`cancel` is OPTIONAL on the port**: a cache that cannot cancel finishes a request
nobody wants, which is wasteful and never wrong, while declaring it as a no-op
would tell a caller the request stopped. Writing this member found four more
facts no reading would have — `subscribe` fires immediately where `listen` does
not, attaching MOUNTS a store so an unconditional attach looks watched forever,
key parts are joined with nothing so a store must be addressed by `store.key`,
and a failure is remembered so a failed read has to drop the store.

**Why only two.** Apollo, urql and RTK Query are a transport AND a cache, so they
replace a layer rather than adapt to one — lanka already has a gateway layer.
SWR's public surface has no cache subscription and no cancellation at all. The
measurement is in `skills/hosts/SKILL.md`, so the next reader sees the reasons
rather than asking again. `@nanostores/query` is named as the candidate whose
one missing operation could come back: a signal reaching its fetcher reopens it.
