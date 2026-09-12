# 13 — Storage adapters: the port into core, and the shelf

`ILankaStorageAdapter` becomes `lanka/storage`, a conformance suite makes it
falsifiable, and `modules/storage-adapters/` fills the `native` runtime that core
has been promising with nothing behind it.

## What is being built

`@lankajs/storage` binds the port twice and both are browser: `LankaWebStorageAdapter`
over `localStorage`, `LankaCacheStorageAdapter` over the Cache Storage API. `core`
declares `runtime: ["browser", "node", "native"]` and `@lankajs/storage` declares
`["browser"]` — so on React Native the framework loads and has nowhere to put a
token.

**Measured in 13.1, not assumed: it is two, not three.** `LankaIndexedDbAdapter`
implements `ILankaBlobStoreAdapter` — records carrying a `Blob`, for
`@lankajs/blob-cache` — and its own file header says so in its first paragraph,
while its class docblock and the registry both called it a third handler of the
same port. A string contract there would mean base64 and a third more bytes. Both
documents are corrected in 13.1; nothing in the code moved.

The port to fill that gap already exists and is already the right shape: the
sync/async split is drawn, `keys?()` is already optional because Cache Storage
cannot enumerate what it was given. What is missing is a shelf, the two members
that make a shelf legal, and a suite that decides whether a member keeps the
promise.

## The measurement this rests on

Read on 2026-09-12 from vendor documentation, not from memory.

| Candidate | Shape | Verdict |
| --- | --- | --- |
| `react-native-mmkv` | synchronous JSI/Nitro; `getString/set/delete/getAllKeys`; encrypts itself | **member.** The only engine that can fill `ILankaSyncStorageAdapter` on native, which is what keeps a persisted zustand store from flashing on mount |
| `@react-native-async-storage/async-storage` | asynchronous; `getAllKeys`, `clear`, `multiGet` | **member.** The port lands on it one-to-one, and it is what existing applications already have installed |
| `expo-secure-store` | asynchronous; keychain / keystore | **member, and the one that bends the port** — no `clear`, no key enumeration, ~2 KB per value |
| `unstorage` | 20+ drivers: fs, Redis, Cloudflare KV, Vercel KV, Netlify Blobs, Mongo, SQL, Capacitor, browser | **member**, not a hub — see below |
| `expo-sqlite`, `op-sqlite` | a database, not a key-value store | rejected. Key-value over SQL is a two-column table; whoever wants it writes an unstorage driver |
| `idb-keyval`, `localforage` | browser | rejected. A second answer to what `LankaIndexedDbAdapter` already answers |
| `node:fs`, `node:sqlite` | server | rejected as packages. Covered by unstorage drivers, which is where `@lankajs/host/server` looks |

**Four members and no hub**, against the two the gate demands. Each differs from
the others in what it CANNOT do, which is what makes the shelf worth building
rather than four spellings of one wrapper.

`unstorage` was planned as the hub and is a MEMBER. A hub is the family's own
package, whose surface is deliberately unlike the others' — `@lankajs/any-schema`
routes between vendors and binds none. unstorage is a vendor like any other: it
has a name in its exports, it binds the port once, and anonymising its surface
gives exactly what the other three give. Calling it a hub would have exempted it
from the comparison that proves the shelf means anything.

## The port moves to core, and the reason is written down already

`scripts/registry.mjs`, in the test kit's own notes:

> Storage: this package depends on `lanka` and nothing else, and a double over a
> MODULE's port would invert the direction the whole repository points.

The kit is where a conformance suite lives — `lankaValidatorConformance` and
`lankaReadCacheConformance` both do. So a suite for storage is IMPOSSIBLE while
the port is in a module, and a family with no suite is four packages promising
interchangeability with nothing checking it.

`core/src/cache/` is the precedent and it is exact: one interface, one type, zero
runtime, exported from `lanka/cache` and called by nothing inside core.
`lanka/storage` is built the same way.

Rejected alternative: amend rule 5d from "the same core port" to "the same port",
which `_plans/12` proposed and did not take. It would have been one sentence
instead of a subsystem — but the kit's objection above is not about the canon's
wording, and no wording fixes it.

**Nothing published is removed.** `@lankajs/storage` keeps exporting all three
interfaces; they become re-exports of core's, so every consumer's import line and
every assignability holds.

## What changes in the port itself

Today the port says `clear()` and means it. `expo-secure-store` can delete a key
it is given and nothing else — no enumeration, no wipe. This is the `cancel`
moment from plan 12, and the answer is the OPPOSITE one, deliberately:

- `cancel` became optional because "the request finishes and its answer is
  discarded" is wasteful and never wrong;
- `clear()` stays REQUIRED, because "the session ended and the tokens are still
  there" is not wasteful, it is the failure. An engine that cannot enumerate
  keeps its own index of what it wrote. The cost lands on the one adapter that
  has the problem instead of on every caller.

The clauses, as they will stand in the port's docblock:

1. Values are strings, and what was written comes back byte-for-byte — `""`,
   `"null"` and `"{}"` included. (unstorage deserialises by default; an adapter
   using its plain `getItem` fails this one.)
2. A missing key answers `null`. Never `undefined`, never a throw.
3. `removeItem` of a key that is not there succeeds.
4. `setItem` over an existing key replaces it.
5. `clear()` empties this adapter's namespace: afterwards every key it wrote
   answers `null`.
6. `keys()` is optional. Declared, it answers what this adapter wrote and
   nothing else — the namespace's keys, not the engine's.
7. An engine that can neither enumerate nor wipe keeps its own index, so
   clause 5 holds anyway.
8. The synchronous half is all-or-nothing. `supportsSyncStorage` narrows on
   three methods; an adapter declaring two of four type-checks and lies.
9. Sync and async see one store: a value written by one is visible to the other.
10. A value the engine cannot hold fails loudly. Truncation is the failure that
    surfaces as a corrupt token a week later.

Three more cannot be checked from inside an implementation and belong to whoever
wires one: the adapter takes its engine as a parameter and never constructs it
(`new LankaWebStorageAdapter(localStorage)` is the existing shape, and it is also
the only way a native engine is testable in node); an engine that encrypts itself
— MMKV with a key, SecureStore by being the keychain — makes
`LankaEncryptedStorage` a second lock on one door; and on a server the namespace
is per request.

## The shelf, and what stays where

`modules/storage-adapters/{mmkv, async-storage, secure-store, unstorage}`, npm
names flat: `@lankajs/mmkv`, `@lankajs/async-storage`, `@lankajs/secure-store`,
`@lankajs/unstorage` — the way `@lankajs/zod` does not say "validators".

Not `modules/storage/*`: rule 5c says a directory under a bucket is a package OR
a family, and `modules/storage` is a published package. Making it the shelf would
push the facade down to `modules/storage/storage`, a level naming what its child
already names.

**The two web adapters do not move.** Two reasons, and the first decides:

- they are names in `@lankajs/storage`'s barrel, and rule 3 does not let a
  published name be removed. The validators never faced this because each vendor
  was born its own package;
- the ticket onto the shelf is a `peerDependencies` entry, not the port.
  `localStorage`, `caches` and `indexedDB` are ambient — a package per browser
  global is a wrapper with nothing to justify it.

So the shelf holds what has a vendor to install, `@lankajs/storage` keeps what
the platform already provides, and the shelf's gist says so — `ls` stops being
the whole answer to "what does lanka support", and pretending otherwise costs
more than one sentence.

## Phases

**13.1 — the port, and something that can fail.** `core/src/storage/` with the
clauses above; `@lankajs/storage` re-exports; `lankaStorageAdapterConformance` in
the kit with the scenes as DATA, plus its own spec running a deliberately broken
adapter and asserting each scene fails. Then everything that already binds the
port goes through it: both web adapters, and the playground's memory double — the
seam a consumer replaces, which is the scene that says the suite is published FOR
adapters this repository has never heard of.

Measuring what is already here before adding anything is the point of the phase.
It found no broken clause and two wrong documents, which is the outcome that pays
for the order.

**13.2 — the shelf and its first member.** The shelf exists from the first
package, and `check-family` was amended to make that legal rather than to waive
its objection: the count is replaced by a CHOICE — a sibling to be compared with,
or a conformance suite to be held to — plus three questions that can fail for a
shelf of one (the surface carries its vendor's name; the shelf holds only what the
registry declares; every member actually runs the suite it names). Canon 5d owns
the rule; `skills/structure/SKILL.md` carries it.

`@lankajs/mmkv` is that first member. It takes its engine as a parameter — the
`new LankaWebStorageAdapter(localStorage)` shape — so it is testable in node,
with a `_playground/` over a double of MMKV's own surface.

**Both majors, told apart by SHAPE.** v4 moved to Nitro and renamed the
constructor (`new MMKV()` → `createMMKV()`, `.delete()` → `.remove()`, RN 0.75+)
while v3 is what most applications have installed. The peer range is `>=3` and
the adapter asks the engine what it can do, which is the trick
`@lankajs/any-schema` already uses to tell schema dialects apart — and a scene
per shape makes the difference checkable rather than assumed.

**13.3 — the one that bends the port.** `secure-store` with its key index, and
the clause-7 scene that proves `clear()` still empties. It is also the first
member to need clause 11: its keys may hold only letters, digits, `.`, `-` and
`_`, so it encodes on the way in and must decode in `keys()`. The index is
written where it is needed, not extracted: one caller is not a helper.

`async-storage` lands here too, and with it the shelf's second member — which is
when the surface comparison starts checking something.

**13.4 — the fourth member, and the runtime that did not follow.** `unstorage`
with the raw pair, as a member rather than a hub.

`@lankajs/storage` was to gain `native` here and did NOT, because `check:runtime`
refused it and was right: six files in that package name `localStorage`,
`caches` or IndexedDB unguarded. The references sit in lazy getters that a
device never reaches — an application handing in `@lankajs/mmkv` never
constructs a browser adapter — but the gate reads the source, not the path taken,
and a package that declares a runtime it has not been made safe for is a promise
nobody checked.

The remaining work is that package's own, and it is a separate change: guard the
six references with `typeof` and fail with a sentence naming the fix, or move the
browser adapters behind an entry of their own. Both change what happens when no
handler was passed, which is published behaviour. The registry entry carries the
reason where the next reader will find it.

## What the work found

- **Two adapters bind the port, not three** (13.1). `LankaIndexedDbAdapter` is a
  blob store, and two documents said otherwise.
- **unstorage rewrites keys**, measured over every ASCII punctuation mark: `/`
  and `\` become `:`, `?` truncates the rest, and `a::b` and `a:b` are ONE row.
  The first two break clause 11; the third silently merges two keys an
  application means to keep apart. The member escapes those characters, and its
  spec re-takes the measurement on every run so the table cannot go stale.
- **A first probe of that was wrong** and a test caught it: shell escaping made a
  backslash look harmless. The second probe went through a file.
- **`@lankajs/storage` is not native-safe**, above.

## Harvest

- the peer-dependency criterion for membership → `skills/structure` 5d;
- why a shelf may hold one package → `skills/structure` 5d, done in 13.2;
- why `clear()` stayed required where `cancel` went optional → the port's
  docblock, beside the clause;
- the rejection table → `modules/storage-adapters/` gist and the family's README;
- why unstorage is a member and not a hub → `skills/structure` 5d, beside the
  hub's definition;
- the unstorage key measurement → it lives in `driverKeyCodec`'s docblock and is
  re-taken by its spec, which is where a measurement belongs;
- why the two key codecs are not shared → both docblocks say it: a member may not
  depend on a sibling, and core has no business holding a keychain's alphabet;
- the kit's note about not doubling storage is now WRONG and must be rewritten,
  not deleted: it recorded a real direction, and the port moving is what changed
  it;
- `@nanostores/query`'s door stays open; this plan opens one of its own —
  `expo-sqlite` becomes a member the day someone needs a store larger than a
  key-value engine holds, and the answer today is an unstorage driver.
