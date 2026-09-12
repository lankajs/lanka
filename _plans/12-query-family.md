# 12 — The query family

`lanka/cache` publishes the port. `modules/query/` holds the two packages that
bind it, and the conformance suite lets an application bind it itself.

## What is being built

lanka ships no cache, by a decision recorded twice. That decision holds while
there is a HOST: Next, React Router v7 and TanStack Start each carry a request
cache, and a second one disagrees with theirs on the first mutation. In a plain
Vite SPA the slot is not taken, it is EMPTY — two screens reading one resource
send two requests and grow two independently ageing copies.

This fills that slot without core learning what a cache DOES. Core gains seven
signatures and no behaviour; the vendors live in modules; and an application that
wants a third one runs the same assertions the two members pass.

## The measurement this rests on

Taken from the published tarballs on 2026-09-12, not from memory. Seven
operations against every candidate that could plausibly sit under a ViewModel:

| | read+dedupe | write | invalidate | subscribe | cancel | peek | clear | |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@tanstack/query-core` 5.102.8 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **member** |
| `@nanostores/query` 0.3.4 | ✓ | ✓ | ✓ | ✓ native | ✗ | ✓ | ✓ | **member** |
| `@data-client/core` 0.18.1 | ✓ | normalizes | ✓ | middleware only | ✗ | denormalizes | ✓ | no |
| `swr` 2.5.1 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | no |
| `@epic-web/cachified` 5.6.3 | ✓ | adapter | `softPurge` | ✗ | ✗ | ~ | ~ | no |
| `@apollo/client` 4.3.0 · `@urql/core` 6.0.3 · `@reduxjs/toolkit` 2.12.0 | — | — | — | — | — | — | — | no |

Weekly downloads, for scale rather than for ranking: query-core 48.7M, swr
12.6M, cachified 85k, data-client 11.4k, nanostores/query 5.5k.

**Owning the wire disqualifies three.** Apollo, urql and RTK Query are a
transport AND a cache. lanka already has a transport — the gateway layer, and
`@lankajs/plugin-graphql` for GraphQL. A package bringing a second wire replaces
a layer rather than adapting to one.

**SWR cannot be observed.** Its public imperative surface is `preload`, `mutate`
and `unstable_serialize`. A cache subscription needs a custom cache provider
wired through the React context `SWRConfig`, and there is no public cancellation
at all. Plus `peerDependencies: react` and no framework-free core.

**Data Client has the operations but not the model.** `controller.subscribe()`
takes no callback — it marks an endpoint as watched, for polling; observing
changes means installing a Middleware in the dispatch pipeline. And its unit is
an Endpoint with a schema: `write` of a domain object means "normalise into
entities" and `peek` means "denormalise back". That is a different contract, not
a different spelling of this one.

**Cachified is a server-side get-or-set** over a pluggable store, with
stale-while-revalidate and no observation. Right for a loader, not for a screen.

## What the measurement changed in the port

`cancel` is not implementable by three of the four candidates that otherwise fit.
When only its author can implement an operation, it is not a port — it is a
description of that author.

For `@nanostores/query` this is structural rather than an oversight: its
`Fetcher` is declared `(...args: KeyParts) => Promise<T>`, so no `AbortSignal`
reaches the loader at all.

Moving cancellation to the ViewModel is wrong: under deduplication a second
reader joins the first's request in flight, and a cancellation by the first tears
it out from under the second. Cancellation belongs to whoever owns the dedup.

So **`cancel` is OPTIONAL**. An implementation that cannot cancel does not
declare it; a ViewModel reads its absence as "the request will finish and be
discarded" — wasteful, never wrong. This is also what makes the port safe to
grow: every later addition is an optional member.

## The port, and where it lives

`ILankaReadCache` in **core**, at a new `lanka/cache` subpath. Seven signatures,
no implementation, no extension point — core gains a shape and no behaviour.

```ts
read<T>(key, load: (signal: AbortSignal) => Promise<T>, options?: { staleMs?: number }): Promise<T>;
write<T>(key, data: T): void;
invalidate(key): Promise<void>;
subscribe(key, onData: (data: unknown) => void): () => void;
peek<T>(key): T | undefined;
clear(): void;
cancel?(key): void;   // optional: see above
```

**Why core rather than a member.** Two members share it, and this repository's
own rule for that case is "what two plugins share belongs in core" — the point
being that siblings must not depend on each other. The alternatives and why they
lose:

| Where | Why not |
| --- | --- |
| in one member, the other depends on it | asymmetric; `check-family` compares surfaces and would report the difference it caused |
| duplicated in both, kept identical by the gate | two declarations of one shape. `TLankaInferred` is duplicated per validator, but its BODY differs per vendor; this body would not |
| a third non-vendor package on the shelf | a shelf entry that is not a vendor breaks what the shelf means |
| nowhere — structural typing only | a ViewModel's `services: { cache: ? }` would have no name to write, which is the whole point of the port |

**Why a new subpath and not `lanka/viewmodel`.** A ViewModel holds one, but so
does a bootstrap service and a scenario handler; the subject is the cache, not
the screen. The cost is a registry line, a folder with a barrel, and a line in
`core/src/publicSurface.test.ts`.

**Facade tier, not `extend`.** `extend` was the first instinct — the shape is
young, and `check-api` suggests exactly that for a new name. It is wrong here:
the members' classes implement the port, so a consumer who cannot import it
cannot spell the signature they are implementing. `skills/surface` 1a puts "a
port a consumer implements" in the facade. The instability is answered by
keeping it small and growing it with optional members.

## The two members

`modules/query/tanstack` → `@lankajs/tanstack-query`, peer
`@tanstack/query-core`.
`modules/query/nanostores` → `@lankajs/nanostores-query`, peer
`@nanostores/query` + `nanostores`.

Both `runtime: ["browser", "node", "native"]`: neither peer pulls React, which is
what keeps them universal like every validator.

**TanStack is the recommendation, and the guide says so first.** It is the only
member that implements all seven, it has devtools, and it is what an application
will already have if it has anything.

**nanostores is the right choice when** the application already uses nanostores
for its own state — then it is one cache rather than two, and one subscription
model rather than two. Its `invalidateKeys` / `revalidateKeys` pair also states
"drop it" and "fetch it again" as two operations, where TanStack needs
`refetchType` chosen by hand.

**Do not take nanostores when** you need cancellation, devtools, or pagination.
Two of those are the reason the port has an optional member at all.

### What is not in either

- **Pagination.** `readInfinite`, `useSWRInfinite` and `fetchMore` are three
  models, not three spellings. It arrives when a consumer says what they could
  not express.
- **Mutations.** Reads are cached; a save is a ViewModel action through a
  gateway, and the cache is told afterwards. Already proven by core's scenes.
- **A React entry** in either package.

### The invariant worth enforcing in the signature

The vendor's client — a `QueryClient`, a `nanoquery()` result — is a REQUIRED
constructor parameter, never defaulted. An application that also reads a resource
with `useQuery` in a component must give both halves the same client; two clients
disagree on the first mutation, silently. One line at start-up is cheaper than
that class of bug.

## Bringing your own

The third way to fill the slot is to implement the port. That is supported, not
tolerated, and the support is executable:

`@lankajs/tool-testing` gains `./lankaReadCacheConformance` — the assertions both
members pass, taking a factory and running against it. An application writing an
adapter over a cache this repository never heard of runs the same suite, and
either passes or learns which promise it broke.

The rules a member must also keep, stated in the guide because no suite can check
them:

1. **It does not own the wire.** The loader comes from the ViewModel, which got
   it from a gateway. An implementation that fetches by itself has replaced a
   layer.
2. **One client per application.** If anything else in the application reads the
   same cache, it must be the same instance.
3. **Reads only.** A mutation is a ViewModel action; the cache is told after.
4. **`cancel` is declared only if it really cancels.** Declaring it as a no-op is
   worse than omitting it: a ViewModel would believe the request stopped.

---

## Phases

### Phase 1 — the port, the shelf, one word of canon

**Result:** `lanka/cache` publishing `ILankaReadCache`; `modules/query/` declared
in `FAMILIES`; `skills/structure` 5d reads "the same port" rather than "the same
core port".

**Preconditions:** plan 11 landed — `FAMILIES`, `familyMembers`, `familyDirs`,
the deeper globs and `check-family` are the machinery this reuses. With two
members, `check-family`'s refusal of a family below two needs no change at all.

**TDD points:**

- written first and fails: `core/src/publicSurface.test.ts` expects `cache` in
  the subpath map. **What makes it fail:** the map is a declaration, so a new
  subsystem is invisible until it is listed — which is the failure that check
  exists for.
- written first and fails: `check-family` reports the `query` family and counts
  what it compared. A gate announcing "0 families compared" while returning
  success is the fourth way a check reports success.
- written after: `check-extension-points` still finds six doors. A published type
  is not a door; if this gate reacts, the placement is wrong and phase 1 stops.

**Acceptance:** `pnpm --filter lanka test`, `node scripts/check-api.mjs --write`
and reading the diff (one new type), `node scripts/check-structure.mjs`,
`node scripts/check-family.mjs`, `pnpm run test:scripts`.

**Regression:** the validators family must keep failing for every reason it fails
today; its six members are the fixture.

**Rollback:** the subsystem is a folder and two declarations; the shelf is a
directory and a registry line.

### Phase 2 — the conformance suite, and the double that proves the port is one

**Result:** `@lankajs/tool-testing` publishes `./lankaReadCacheConformance` and
`createLankaFakeReadCache` — a `Map` implementation of the seven operations,
`cancel` included.

**Preconditions:** phase 1. The kit depends on `lanka` and on nothing else, which
is exactly why the port had to land in core first.

**TDD points:**

- written first and fails: the suite fails an implementation that answers a stale
  key from memory;
- written first and fails: the suite fails one that calls the loader twice for
  two concurrent reads of one key;
- written first and fails: the suite fails one whose `subscribe` never fires;
- written first and fails: the suite PASSES an implementation without `cancel`,
  and fails one that declares `cancel` and does not abort the signal. The optional
  member is the suite's sharpest edge: it must distinguish "absent" from "lying".

**Acceptance:** `pnpm --filter @lankajs/tool-testing test:coverage`,
`node scripts/check-api.mjs`.

**Regression:** the fake is a test double, not a third vendor. If it grows a
behaviour neither member can match, the port has stopped describing the thing it
was drawn from.

**Rollback:** additive; delete the subpath.

### Phase 3 — `@lankajs/tanstack-query`

**Result:** `LankaTanstackCache` + `createLankaTanstackCache`, both styles over
one implementation, the class extending `ALankaSingleton` so it registers by
name.

**Preconditions:** phase 2.

**TDD points:**

- written first and fails: `subscribe` does not deliver a pending or an errored
  state as data. **What makes it fail:** filtering on `event.type` alone.
- written first and fails: `subscribe` for `["order", 1]` hears nothing when
  `["order", 2]` changes. **What makes it fail:** comparing a locally computed
  hash instead of `event.query.queryHash`.
- written first and fails: `invalidate` on an unwatched key issues no request,
  and on a watched key issues one. **What makes it fail:** a fixed `refetchType`;
  `"all"` refetches a screen nobody is looking at, `"none"` leaves a watched one
  stale, so the member counts its own subscribers.
- written first and fails: `cancel` aborts the signal the loader was given.
- written first and fails: constructing without a client is refused.
- written after: `lankaReadCacheConformance` against this implementation.

**Acceptance:** `pnpm --filter @lankajs/tanstack-query test:coverage`,
`check-parity`, `check-forms`, `check-api`.

**Regression:** `@tanstack/react-query` must not be imported anywhere —
`check-runtime` would see React, make the entry client-only, and the package
would stop running in node.

**Rollback:** an application registers the fake instead.

### Phase 4 — `@lankajs/nanostores-query`

**Result:** `LankaNanostoresCache` + `createLankaNanostoresCache`, the same
surface minus `cancel`, which it does not declare.

**Preconditions:** phase 3 — the second member is written against a port that has
already survived one.

**TDD points:**

- written first and fails: `cancel` is absent from the instance, and the
  conformance suite passes anyway;
- written first and fails: two reads of one key share one fetcher store. **What
  makes it fail:** creating a store per call, which leaks one per read and
  defeats the deduplication the cache exists for;
- written first and fails: `invalidate` uses `revalidateKeys` while somebody is
  subscribed and `invalidateKeys` when nobody is — the same distinction TanStack
  needs `refetchType` for, stated by two functions here;
- written after: `lankaReadCacheConformance`, the same call as phase 3.

**Acceptance:** the same four gates, plus `node scripts/check-family.mjs`, which
now compares two real surfaces for the first time.

**Regression:** the two members must differ in exactly one word — the vendor's.
`check-family` is what says so, and phase 4 is the first time it can.

**Rollback:** delete the package; the family returns to one member and the gate
refuses it, which is the signal that the shelf was premature.

### Phase 5 — the playgrounds

**Result:** a miniature application per member: a gateway, a ViewModel reading
through the port, a second reader of the same resource, and a scene per
non-obvious behaviour. The seam is the network, as everywhere.

**Preconditions:** phases 3 and 4.

**TDD points:**

- written first and fails: two ViewModels over one key cost ONE request and share
  the answer;
- written first and fails: a save writes the cache and the second reader sees it
  without a request of its own;
- written first and fails: `dispose()` on a lazy ViewModel releases the
  subscription;
- written first and fails: a cache event never triggers a scenario — the loop
  `invalidate → refetch → event → announce` has no end.

**Acceptance:** `check-structure` rule 11, `check-api` (every facade value in a
scene).

**Regression:** each playground runs its ViewModels over its member AND over the
fake, as core's boundary scenes already do over two implementations. Identical
assertions are what make the port a port.

**Rollback:** additive.

### Phase 6 — documents, and two texts this contradicts

**Result:** `README.md`, `GUIDE.md`, `SKILL.md` and a shipped consumer skill per
member; the measurement table in each README; a row in `ARCHITECTURE.md`'s
adoption table; the "bringing your own" section with the four rules and the
conformance call.

Two existing texts say the opposite of what this ships, and both are corrected
here rather than left to be found:

- `ARCHITECTURE.md`, "Server state when there is no host": the TIP says to wait
  until three independent applications reach the identical port. That is not what
  happened — the port was settled by measuring six libraries against seven
  operations. Say which, or the next reader applies a rule the repository broke.
- `skills/hosts/SKILL.md` §5: "What is NOT reconsidered by that: publishing a
  cache PORT. Only one library can implement an imperative read." The second
  sentence is now measurably wrong — two can — and the first needs its subject
  made explicit: core publishes the port and no cache.

**Preconditions:** phases 1–5. A document describing what does not exist is a
plan wearing a guide's clothes.

**Acceptance:** `check:docs`, `check:llms`, `check:drift` after
`node scripts/scaffold.mjs`.

**Regression:** each guide must open with when NOT to install it. Most consumers
are on a host that already has a cache, and a published package reads as a
recommendation unless the first paragraph says otherwise. The nanostores guide
additionally has to say that TanStack is the default answer.

**Rollback:** documents roll back freely.

---

## Risks

| Risk | What catches it |
| --- | --- |
| The port becomes a mirror of TanStack's API | Seven operations, pagination named as out of scope, and phase 4 — a second vendor written against it is the test of whether it was ever a port |
| `cancel` is declared as a no-op by some future member | Phase 2's sharpest assertion: the suite distinguishes absent from lying |
| A consumer installs a cache on Next and owns two | The adoption row and each guide's first paragraph; nothing mechanical can catch it |
| Two vendor clients in one application | The required constructor parameter |
| The fake drifts from both members | Phase 5 runs every scene over the member and the fake |
| `@tanstack/react-query` or a React entry sneaks in | `check-runtime` |
| A core subsystem holding one type looks like an extension point | Phase 1's third TDD point: if `check-extension-points` reacts, the placement is wrong |

## Harvest

- The measurement table — into both READMEs. It answers "why not Apollo / SWR /
  Data Client" with numbers, so nobody re-asks.
- Why `cancel` is optional — beside its declaration: three of four candidates
  cannot implement it, and nanostores structurally cannot, because no signal
  reaches its fetcher.
- Why the port is in core and not in a member — beside the port, with the four
  rejected placements.
- Why the port is facade and not `extend` — same place: the members' classes
  implement it, so an `extend` port cannot be spelled by its implementer.
- The three silent TanStack behaviours (`refetchType` by subscriber count,
  `queryHash`, `event.action.type`) — comments at each call site.
- Why the nanostores member memoises its fetcher stores — beside that map.
- The four rules for bringing your own — the consumer-facing guide, and the
  conformance suite is their executable half.
- `@nanostores/query` became a member on one measurement; if its `Fetcher` ever
  receives an `AbortSignal`, `cancel` stops being optional for it. Record that so
  the next reader knows what would change.
