# 12 — The query family, and its one member

`@lankajs/tanstack-query` under `modules/query/`, binding a read-cache port the
application owns.

## What is being built

lanka ships no cache, by a decision recorded twice. That decision holds while
there is a HOST: Next, React Router v7 and TanStack Start each carry a request
cache, and a second one disagrees with theirs on the first mutation. In a plain
Vite SPA the slot is not taken, it is EMPTY — two screens reading one resource
send two requests and grow two independently ageing copies.

This package fills that slot without core learning what a cache is.

## The measurement this rests on

Taken from the installed tarballs on 2026-09-12, not from memory. Two criteria
decide, and together they leave one candidate:

| Package | Version | Peer deps | Core without React | Owns the wire | Fit |
| --- | --- | --- | --- | --- | --- |
| `@tanstack/query-core` | 5.102.8 | none | yes | no | **yes** |
| `swr` | 2.5.1 | `react` | no | no | no |
| `@apollo/client` | 4.3.0 | `rxjs`, `react`, `graphql` | no | yes | no |
| `@urql/core` | 6.0.3 | — | partly | yes (exchanges) | no |
| `@reduxjs/toolkit` | 2.12.0 | `react`, `react-redux` | no | yes | no |

**Owning the wire disqualifies three.** Apollo, urql and RTK Query are a
transport AND a cache. lanka already has a transport — the gateway layer, and
`@lankajs/plugin-graphql` for GraphQL. A package bringing a second wire replaces
a layer rather than adapting to one.

**SWR cannot implement the port.** Its public imperative surface is `preload`,
`mutate` and `unstable_serialize`; `read`, `write` and `invalidate` follow from
those. `subscribe` and `cancel` do not exist: a cache subscription needs a custom
cache provider wired through the React context `SWRConfig`, and there is no
public cancellation at all. Two of seven, plus `peerDependencies: react` and no
framework-free core.

Ranking by downloads never happened, because capability had already eliminated
everyone else.

## The shelf, and what it costs

`modules/query/tanstack`, npm name unchanged by the shelf: `@lankajs/tanstack-query`.

A family of ONE is what today's measurement permits, and the repository
currently refuses it in two places, both written on 2026-09-11:

- `check-family.mjs` fails a family with fewer than two members, because "the
  folder adds a level and this gate checks nothing";
- `skills/structure` 5d defines a family as "several packages of one kind that
  bind the same **core** port", and this port is not core's.

Both are amended here, and the first amendment is NOT "remove the guard". A
family of one agrees with itself, so the surface comparison genuinely checks
nothing — the guard was right about that. It is replaced with two questions that
CAN fail for one member:

1. **Does the vendor's name appear in the surface at all?** If anonymising a
   member's exports changes nothing, the package is not vendor-bound and has no
   business on a shelf.
2. **Does the shelf hold only what the registry declares?** A directory under
   `modules/query/` that no `FAMILIES` entry names is a shelf silently becoming a
   package — the failure 5d exists to prevent.

The second amendment is one word: a family binds "the same port", not "the same
core port". What makes a shelf a shelf is that its members are interchangeable,
not where the interface was declared.

## The port

`ILankaReadCache`, seven operations. Five came from the boundary scenes in core's
playground; two are the gaps those scenes did not have a reason to hit.

| | On | Why it is not obvious |
| --- | --- | --- |
| `read(key, load, { staleMs })` | `fetchQuery` | — |
| `write(key, data)` | `setQueryData` | — |
| `invalidate(key)` | `invalidateQueries` | **`refetchType` must depend on whether anyone is listening.** `"all"` refetches a screen nobody is looking at; `"none"` leaves a watched screen stale. The member counts its own subscribers |
| `subscribe(key, onData)` | `getQueryCache().subscribe` | **compare `event.query.queryHash`**, not a hash computed here, and filter on `event.type === "updated"` AND `event.action.type === "success"` — otherwise pending and error states arrive as data |
| `cancel(key)` | `cancelQueries` | — |
| `peek(key)` | `getQueryData` | reading without fetching, for "do I already have it" |
| `clear()` | `client.clear()` | the end of a session, the concern `setupLankaBlobCacheLifecycle` has for bytes |

The three marked rows are the package's reason to exist: each is wrong silently.

**Facade tier, not `extend`.** `extend` was the first instinct — the shape is not
settled, and `check-api` suggests exactly that for a young name. It is wrong
here: the facade class implements the port, so a consumer who cannot import the
port cannot spell the signature they are implementing. `skills/surface` 1a puts
"a port a consumer implements" in the facade. The instability is answered by
keeping it SMALL and growing it with optional members, which is additive.

### What is not in it

- **Pagination.** `readInfinite`, `useSWRInfinite` and `fetchMore` are three
  different models, and with one vendor a common signature would be a mirror of
  TanStack's. It arrives when a consumer says what they could not express.
- **Mutations.** Reads are cached; a save is a ViewModel action through a
  gateway, and the cache is told afterwards. Already proven by the core scenes.
- **A React entry.** The peer is `@tanstack/query-core`, so the package stays
  `runtime: ["browser", "node", "native"]`, like every validator.

### The one invariant worth enforcing in the signature

The `QueryClient` is a REQUIRED constructor parameter, never defaulted. An
application that also reads a resource with `useQuery` in a component must give
both halves the same client; two clients disagree on the first mutation, and the
disagreement is silent. One line of ceremony at start-up is cheaper than the
class of bug it removes.

---

## Phases

### Phase 1 — the shelf, and a gate that can still fail

**Result:** `modules/query/` exists and holds `tanstack`; `check-family` checks
something falsifiable for a family of one; 5d says "the same port".

**Preconditions:** plan 11 landed — `FAMILIES`, `familyMembers`, `familyDirs`,
the deeper globs and the six validators are the machinery this reuses.

**TDD points:**

- written first and fails: a one-member family whose member exports nothing
  carrying its `vendor` word is reported. **What makes it fail:** today the
  member count is refused before any surface is read.
- written first and fails: a directory under a family shelf that no registry
  entry declares is reported. Check first whether another gate already catches
  it; if one does, this belongs there and not here.
- written first and fails: a one-member family whose surface DOES carry the
  vendor word passes, and `compared` counts it — a gate that reports "checked 0
  families" while returning success is the failure this phase exists to avoid.

**Acceptance:** `node scripts/check-family.mjs`, `pnpm run test:scripts`,
`node scripts/check-structure.mjs`.

**Regression:** the validators family must keep failing for every reason it
fails today. Its six members are the fixture: a surface difference between any
two still has to be reported.

**Rollback:** the shelf is a directory and one registry line; `git mv` back and
the gate returns to refusing fewer than two.

### Phase 2 — the port, and the double that proves it is one

**Result:** `ILankaReadCache` in the package's facade;
`createLankaFakeReadCache` at the `/testing` subpath — a `Map` implementation
with the same seven operations.

**Preconditions:** phase 1.

**TDD points:**

- written first and fails: the double answers a fresh key from memory without
  calling the loader;
- written first and fails: two concurrent reads of one key call the loader once;
- written first and fails: `invalidate` on a key nobody subscribed to does not
  call the loader, and on a watched one does.

**Acceptance:** `pnpm --filter @lankajs/tanstack-query test`.

**Regression:** the double is a test double, not a second vendor. It must not
grow a behaviour the adapter cannot match — that is how a port stops describing
the thing it was drawn from. Every assertion in phase 3 runs against both.

**Rollback:** the package is new; delete it.

### Phase 3 — the adapter

**Result:** `LankaTanstackCache` + `createLankaTanstackCache` over
`@tanstack/query-core`, both styles over one implementation, the class extending
`ALankaSingleton` so it registers by name.

**Preconditions:** phase 2.

**TDD points:**

- written first and fails: `subscribe` does not deliver a pending or an errored
  state as data. **What makes it fail:** filtering on `event.type` alone.
- written first and fails: `subscribe` for `["order", 1]` hears nothing when
  `["order", 2]` changes. **What makes it fail:** comparing a locally computed
  hash instead of `event.query.queryHash`.
- written first and fails: `invalidate` on an unwatched key issues no request,
  and on a watched key issues one. **What makes it fail:** a fixed `refetchType`.
- written first and fails: `cancel` aborts the `AbortSignal` the loader was
  given.
- written first and fails: the constructor without a client is a type error and
  a runtime refusal.
- written after: every phase-2 assertion, re-run against this implementation.

**Acceptance:** `pnpm --filter @lankajs/tanstack-query test:coverage`,
`node scripts/check-parity.mjs`, `node scripts/check-forms.mjs`,
`node scripts/check-api.mjs` and reading the diff.

**Regression:** `@tanstack/query-core` is a peer, so the package must not import
`@tanstack/react-query` anywhere — `check-runtime` would see React and make the
entry client-only, and the package would stop running in node.

**Rollback:** configuration — an application registers the `Map` double instead.

### Phase 4 — the playground

**Result:** the package's own miniature application: one gateway, one ViewModel
that reads through the port, a second reader of the same resource, and a scene
per non-obvious behaviour above. The seam is the network, as everywhere.

**Preconditions:** phase 3.

**TDD points:**

- written first and fails: two ViewModels over one key cost ONE request and
  share the answer;
- written first and fails: a save writes the cache and the second reader sees it
  without a request of its own;
- written first and fails: `dispose()` on a lazy ViewModel releases the
  subscription and cancels the load in flight;
- written first and fails: a cache event never triggers a scenario — the loop
  `invalidate → refetch → event → announce` has no end.

**Acceptance:** `node scripts/check-structure.mjs` (rule 11: a package with no
playground is a package nothing exercises whole), `node scripts/check-api.mjs`
(every facade value in a scene).

**Regression:** the scenes must run the ViewModels over BOTH the adapter and the
double, as core's boundary scenes do. Identical assertions are what makes the
port a port rather than a description of TanStack.

**Rollback:** none needed; a playground is additive.

### Phase 5 — documents, and two texts this contradicts

**Result:** `README.md`, `GUIDE.md`, `SKILL.md` and the shipped consumer skill,
generated and written; a row in `ARCHITECTURE.md`'s adoption table.

Two existing texts say the opposite of what this ships, and both are corrected
here rather than left to be discovered:

- `ARCHITECTURE.md`, "Server state when there is no host": the TIP currently
  says to wait until three independent applications reach the identical port.
  That threshold was met differently — not by three consumers, but by one vendor
  turning out to be the only one capable. Say which, or the next reader applies
  a rule the repository already broke.
- `skills/hosts/SKILL.md` §5: "What is NOT reconsidered by that: publishing a
  cache PORT." The sentence is about CORE publishing one, and it stays true —
  core publishes nothing here. Make the subject explicit, and keep the SWR
  measurement as the reason there is one vendor rather than a family.

**Preconditions:** phases 1–4 — a document describing what does not exist yet is
a plan wearing a guide's clothes.

**Acceptance:** `pnpm run check:docs`, `check:llms` (a shipped skill teaches only
names that exist), `check:drift` after `node scripts/scaffold.mjs`.

**Regression:** the guide must open with when NOT to install this. Most
consumers are on a host that already has a cache, and a published package reads
as a recommendation unless the first paragraph says otherwise.

**Rollback:** documents roll back freely.

---

## Risks

| Risk | What catches it |
| --- | --- |
| A family of one makes `check-family` unfalsifiable | Phase 1's three TDD points; the gate must report what it COMPARED, not only that it found no problems |
| The port becomes a mirror of TanStack's API | Seven operations, and pagination named as out of scope with its reason. A growth request arrives from a consumer or not at all |
| A consumer installs it on Next and owns two caches | The adoption row and the guide's first paragraph; nothing mechanical can catch it |
| Two `QueryClient`s in one application | The required constructor parameter |
| The double drifts from the adapter | Phase 4 runs every scene over both |
| `@tanstack/react-query` sneaks in | `check-runtime` — the entry would need `"use client"` and the package would stop being universal |

## Harvest

- The measurement table — into `README.md`: it explains why the family has one
  member better than any prose about extensibility.
- Why the port is facade and not `extend` — a comment where it is declared: the
  facade class implements it, so an `extend` port cannot be spelled by the
  consumer implementing it.
- The three silent behaviours (`refetchType`, `queryHash`, `event.action.type`)
  — comments at each call site. They are the package's whole reason to exist and
  each is invisible in a reading.
- Why the `QueryClient` is required rather than defaulted — beside the
  constructor.
- What a family of one must still prove — `skills/structure` 5d, beside the
  amendment, so the next one-member shelf is not argued from scratch.
- Whether any gate already catches an undeclared directory on a shelf — wherever
  the answer turns out to live.
