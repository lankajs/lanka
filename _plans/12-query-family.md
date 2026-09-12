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
/**
 * A resource's address. Strings, numbers and booleans only — NOT `unknown[]`.
 * `@nanostores/query` accepts `string | number | true` as a key part and cannot
 * carry an object, so a wider type would be a promise one member cannot keep.
 */
type TLankaCacheKey = readonly (string | number | boolean)[];

read<T>(key: TLankaCacheKey, load: (signal?: AbortSignal) => Promise<T>, options?: { staleMs?: number }): Promise<T>;
write<T>(key: TLankaCacheKey, data: T): void;
invalidate(key: TLankaCacheKey): Promise<void>;
subscribe(key: TLankaCacheKey, onData: (data: unknown) => void): () => void;
peek<T>(key: TLankaCacheKey): T | undefined;
clear(): void;
cancel?(key: TLankaCacheKey): void;
```

The signal is OPTIONAL in `load`'s signature, not merely absent at runtime. An
implementation that cannot cancel passes nothing; handing over a signal that can
never fire would be a promise broken silently, and `TLankaExecuteOptions.signal`
already accepts `undefined`, so a gateway call is written the same way either
way.

## The contract, clause by clause

Everything below is a place where two honest implementations diverge. Each is
settled here, checked by the conformance suite where a suite can, and stated in
the guide where none can. **This table IS what somebody writing a third
implementation reads.**

| # | The promise | Why it would otherwise diverge | Settled by |
| --- | --- | --- | --- |
| 1 | `subscribe` does NOT deliver the current value | nanostores' `.subscribe()` calls the listener immediately, `.listen()` does not; TanStack's cache does not. The member must use `listen` | suite |
| 2 | `subscribe` delivers only SETTLED data — never a pending or a failed state | TanStack's cache emits on every query action; the member filters `event.type === "updated"` AND `event.action.type === "success"` | suite |
| 3 | the release `subscribe` returns removes exactly its own listener, and a second call does nothing | releasing by callback identity removes the first listener carrying that function, which is not necessarily the caller's | suite |
| 4 | `peek` answers what is cached, stale or not; it never fetches and never throws | an implementation could reasonably answer `undefined` for stale data | suite |
| 5 | `read` answers from memory while fresh; two concurrent reads of one key call `load` ONCE | the whole reason a cache is under the ViewModel | suite |
| 6 | `read` rejects with exactly what `load` threw | **a cache that wraps errors breaks the entire failure pipeline** — a ViewModel sorts by `LankaError.kind`, and a wrapper makes every failure the screen's | suite |
| 7 | a failed `read` is not remembered as data; the next `read` tries again | TanStack briefly caches an error; the member must not present it as a value | suite |
| 8 | `invalidate` resolves AFTER the refetch settles when somebody is subscribed, and marks stale without fetching when nobody is | TanStack needs `refetchType` chosen by subscriber count; nanostores states it as two functions, `revalidateKeys` and `invalidateKeys`, one of which returns nothing to await | suite |
| 9 | `write` notifies that key's subscribers before it returns | both can do it synchronously; leaving it unspecified makes a consumer's `expect` pass on one member and fail on the other | suite |
| 10 | `clear` empties everything and notifies NOBODY | it runs at sign-out, where the screens are going away. nanostores must clear its map WITHOUT revalidating, or a dead session refetches | suite |
| 11 | `cancel` is declared only if it really aborts; absent means "the request finishes and is discarded" | a no-op `cancel` is worse than none: a ViewModel would believe the request stopped | suite (absent passes; declared-and-lying fails) |
| 12 | the implementation never refetches on its own — only `read` and `invalidate` fetch | background revalidation would change a form's `server` version under the user's hands, which the Forms boundary forbids | suite (no `load` during a quiet interval) |
| 13 | a subscriber must not `write` the key it observes | no implementation promises loop protection | guide |
| 14 | on a server the cache is per REQUEST, never a module-level singleton | the hazard ViewModels already have: one instance per process is one shared by every user | guide |
| 15 | one client per application | if anything else reads the same vendor cache, it must be the same instance; two disagree on the first mutation | guide |
| 16 | the implementation does not own the wire | the loader comes from a ViewModel, which got it from a gateway. One that fetches by itself has replaced a layer | guide |
| 17 | a resource lives in exactly ONE cache | two implementations holding one key is the "two caches disagree on the first mutation" failure, one level down. No port can see the other one | guide |

## Mixed use — supported, not recommended

The validator family already answers this shape: core accepts any Standard
Schema, so an application CAN hold zod and valibot at once, and both the
`ARCHITECTURE.md` warning and each member's first invariant say to install one.
Query has the same stance and three different mixtures, which are not equally
harmless.

| Mixture | Supported because | Not recommended because | The hard rule |
| --- | --- | --- | --- |
| **Two members in one application** — TanStack for most resources, nanostores for a subtree | the locator holds NAMES, not one object; a ViewModel takes whichever it is handed | the dependency list stops saying which cache the application has, and two caches are two eviction policies, two devtools stories and two answers to "is this fresh" | **clause 17**: the split is by RESOURCE and the sets never overlap. One key in two caches is a disagreement with no owner |
| **A member under the ViewModels AND `useQuery` in components** — same vendor | it is the shape an application already built on TanStack Query adopts lanka into; the eslint rule's `allowedDirs` names the query-hooks folder rather than being switched off | the screen stops being "one hook", and a resource now has two readers with two staleness settings | **clause 15**: the same client instance in both halves, and one `staleTime` per resource |
| **Some ViewModels with a cache, some without** | a ViewModel takes the port or `null`; core's own boundary scenes run the same ViewModel both ways | nothing — this one is ordinary | only shared resources need a cache; a screen that owns its data needs none |

The third is not really a mixture and the guide should say so, or a reader
concludes that adopting a cache means adopting it everywhere.

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

**No canon amendment is needed, and that follows from where the port went.**
`skills/structure` 5d defines a family as "several packages of one kind that bind
the same **core** port". Two members satisfy "several", and because
`ILankaReadCache` lives in `lanka/cache`, "core port" holds as written. Had the
port stayed inside a member, both halves of that sentence would have needed
rewriting to fit.

**The shelf is declared with the SECOND member, never before it.**
`check-family.mjs` refuses a family below two, because "the folder adds a level
and this gate checks nothing" — which is correct, and a `FAMILIES` entry added
early would fail `pnpm check` until phase 4. So `query` joins `FAMILIES` in the
phase that lands `@lankajs/nanostores-query`. Until then the TanStack package
carries `family: "query"`, which is what resolves its path, while no shelf is
claimed.

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

```ts
import { lankaReadCacheConformance } from "@lankajs/tool-testing/lankaReadCacheConformance";

lankaReadCacheConformance(() => createMyCache(myClient));
```

Twelve of the sixteen clauses above are assertions in that suite. It takes a
factory and runs the same cases both members pass, so an adapter over a cache
this repository never heard of either passes or learns which promise it broke —
by number, with the clause quoted in the failure.

The remaining four cannot be checked by any suite — a lifetime, an instance
count and a layering are not observable from inside — so they are stated in the
guide, each with what goes wrong: clauses 13 to 16.

**A third implementation needs three things and nothing else:** the port's
signature, this table, and the suite. It does not need to read a member's source,
which is the test of whether the contract is written down or merely embodied.

---

## Phases

### Phase 1 — the port ✅ done

**Result:** `lanka/cache` publishing `ILankaReadCache` and `TLankaCacheKey`, and
nothing else. No shelf yet — see above — and no canon change.

**Preconditions:** plan 11 landed — `FAMILIES`, `familyMembers`, `familyDirs`,
the deeper globs and `check-family` are the machinery the later phases reuse.

**What running it settled:** a types-only entry DOES build and publish.
`dist/cache/index.js` is a 33-byte empty module beside a 5 KB `.d.ts`;
`check-publishable` finds the target, and `check-runtime` reads the entry as
universal. The `lanka/viewmodel` fallback is not needed and the note about it can
go once this plan is harvested.

**The one thing to verify before writing anything:** `lanka/cache` would be the
first core entry whose source declares only TYPES, and tsup builds "one file per
entry in `exports`". A type erases, so the entry's JavaScript is empty. Confirm
that tsup emits it, that `check-publishable` finds the target in `dist`, and that
`check-runtime` reads an entry reaching no React as universal rather than as
nothing.

**If it does not build, the port joins `lanka/viewmodel` instead** — a ViewModel
is what holds one, the barrel already exists, and the only loss is that the
subject of the subpath stops being the cache. Decide by running it, not by
arguing.

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
and reading the diff (two new types — the port and `TLankaCacheKey`),
`node scripts/check-structure.mjs`, `node scripts/check-family.mjs`,
`pnpm run test:scripts`, `pnpm run verify:build`, `pnpm run check:publishable`.

**Regression:** the validators family must keep failing for every reason it fails
today; its six members are the fixture.

**Rollback:** the subsystem is a folder, a registry line and a line in the
subpath map.

### Phase 2 — the conformance suite, and the double that proves the port is one

**Result:** `@lankajs/tool-testing` publishes `./lankaReadCacheConformance` and
`createLankaFakeReadCache` — a `Map` implementation of the seven operations,
`cancel` included.

**Preconditions:** phase 1. The kit depends on `lanka` and on nothing else, which
is exactly why the port had to land in core first.

**The suite's own fixtures are wrong implementations.** Each of clauses 1–12 gets
a deliberately broken double, and the assertion is that the suite REJECTS it.
Without that, a suite passing both members proves only that it agrees with them.

**TDD points:**

- written first and fails, one per clause: a double that delivers the current
  value on subscribe (1), that emits a pending state (2), that releases by
  callback identity (3), that answers `undefined` for stale (4), that loads twice
  for two concurrent reads (5), **that wraps the loader's error (6)**, that
  remembers a failure as data (7), that resolves `invalidate` before the refetch
  (8), that notifies asynchronously on write (9), that notifies on clear (10),
  that refetches unasked (12) — each must be reported, and reported by clause
  number.
- written first and fails: the suite PASSES an implementation without `cancel`
  and FAILS one that declares `cancel` and does not abort the signal (11). This
  is the sharpest edge in the suite: it has to tell "absent" from "lying".
- written first and fails: the suite refuses a key containing an object, because
  `TLankaCacheKey` forbids it and a member would otherwise diverge at runtime.

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
- written first and fails: `clear()` notifies nobody. **What makes it fail:**
  `client.clear()` emits removal events, and a filter written only for
  `event.type` would forward them.
- written after: `lankaReadCacheConformance` against this implementation.

**Acceptance:** `pnpm --filter @lankajs/tanstack-query test:coverage`,
`check-parity`, `check-forms`, `check-api`.

**`check-parity` needs a row.** Its `ROLES` list is hard-coded, and a class with
a factory twin is already treated as a role there — `LankaFetchJsonRequest` and
`createLankaFetchJsonRequest` are the precedent. Add the member with its
`demonstrate` directory, or the pair is unchecked and the two styles drift where
no reviewer looks.

**Regression:** `@tanstack/react-query` must not be imported anywhere —
`check-runtime` would see React, make the entry client-only, and the package
would stop running in node.

**Rollback:** an application registers the fake instead.

### Phase 4 — `@lankajs/nanostores-query`

**Result:** `LankaNanostoresCache` + `createLankaNanostoresCache`, the same
surface minus `cancel`, which it does not declare — **and the shelf**: `query`
joins `FAMILIES`, `pnpm-workspace.yaml` gains `modules/query/*`. This is the
first moment a `FAMILIES` entry can exist without failing its own gate.

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
  needs `refetchType` for, stated by two functions here — and it resolves only
  after the store has stopped loading, since `revalidateKeys` returns nothing to
  await;
- written first and fails: the member subscribes with nanostores' `listen`, not
  `subscribe`. **What makes it fail:** `subscribe` calls the listener immediately
  with the current value, so a ViewModel would receive `undefined` as data the
  moment it starts listening — clause 1, and the divergence that made the clause
  necessary;
- written first and fails: `clear()` empties the map WITHOUT revalidating. **What
  makes it fail:** `invalidateKeys` over a watched key refetches, and at sign-out
  that is a request with a dead session;
- written after: `lankaReadCacheConformance`, the same call as phase 3.

**Acceptance:** the same four gates, plus `node scripts/check-family.mjs`, which
now compares two real surfaces for the first time.

**Regression:** the two members must differ in exactly one word — the vendor's.
`check-family` is what says so, and phase 4 is the first time it can.

**Rollback:** delete the package AND the `FAMILIES` entry together. Leaving the
entry behind is a family of one, which the gate refuses — correctly, and that
refusal is the signal that the shelf was claimed too early.

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
  `invalidate → refetch → event → announce` has no end;
- written first and fails: the SAME ViewModel runs with the port and with `null`,
  and both answer the same data — the third row of the mixed-use table, which is
  the one a reader will otherwise take for a mixture.

Each playground CALLS `lankaReadCacheConformance` against its own member. Not
only in the specs: `check-api` reads playgrounds and benches for demonstration,
and a facade value exercised only by a test is reported undemonstrated — which is
also true of a reader looking for how the suite is used.

**Acceptance:** `check-structure` rule 11, `check-api` (every facade value in a
scene).

**Regression:** each playground runs its ViewModels over its member AND over the
fake, as core's boundary scenes already do over two implementations. Identical
assertions are what make the port a port.

**Rollback:** additive.

### Phase 6 — documents, and two texts this contradicts

**Result:** `README.md`, `GUIDE.md`, `SKILL.md` and a shipped consumer skill per
member; the measurement table in each README; a row in `ARCHITECTURE.md`'s
adoption table; the contract table and the conformance call in the guide; the
mixed-use table beside it.

`ARCHITECTURE.md`'s existing warning already tells an application to install one
validation package rather than both. The same sentence gains the cache: install
one member, and where an application genuinely needs two, the split is by
resource and the sets do not overlap. Each member's `SKILL.md` invariant 1 says
it too, as the validators' already do.

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
| A types-only entry does not build or does not publish | Phase 1's verification, run before anything is written, with `lanka/viewmodel` as the stated fallback |
| The suite agrees with the members instead of checking them | Phase 2's broken doubles: one per clause, and the assertion is that the suite REJECTS each |
| The two members' class/factory pairs drift | A `check-parity` `ROLES` row per member — the pair is unchecked until one exists |
| `lankaReadCacheConformance` is called only from tests | `check-api` would report it undemonstrated; the call belongs in each playground, which is also where a reader looks for it |
| Two members end up holding one resource | Clause 17, and nothing mechanical — the mixed-use table is the whole defence |

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
- The seventeen clauses — the consumer-facing guide, where a third implementer
  reads them; twelve of them are also the suite, which is their executable half.
  The four that no suite can check keep their "what goes wrong" beside them, or
  the next reader treats them as style.
- The mixed-use table — the guide and `ARCHITECTURE.md`'s warning, beside the
  sentence that already says to install one validator rather than two.
- Why `TLankaCacheKey` forbids an object — beside the type: nanostores accepts
  `string | number | true` as a key part, so a wider key is a promise one member
  cannot keep.
- Why nanostores uses `listen` and not `subscribe` — beside that call: the latter
  fires immediately with the current value, and a ViewModel would take it as
  data.
- `@nanostores/query` became a member on one measurement; if its `Fetcher` ever
  receives an `AbortSignal`, `cancel` stops being optional for it. Record that so
  the next reader knows what would change.
