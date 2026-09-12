---
"@lankajs/mmkv": major
"@lankajs/react-native-async-storage": major
"@lankajs/secure-store": major
"@lankajs/unstorage": major
"@lankajs/storage": patch
---

The storage-adapter family: four engines behind one port

`modules/storage-adapters/` is a shelf, and it holds one package per storage
engine. Each takes its engine as a PARAMETER and imports the vendor nowhere — the
shape `new LankaWebStorageAdapter(localStorage)` has had since the beginning. A
native module cannot run in node, so an adapter that reached for the library
itself could only be tested by the application that shipped it.

All four answer `lankaStorageAdapterConformance` — eleven clauses, twenty-one
scenes — and their surfaces differ in exactly one place: the vendor's name.

**`@lankajs/mmkv`** is the one to take first on a device, and the only engine
that fills the SYNCHRONOUS half: a store read during the first render either has
its value or renders twice. It supports both majors and tells them apart by
SHAPE — v4 renamed `.delete()` to `.remove()`, and `package.json` says what the
consumer wrote while the instance says what they got. An instance with neither
throws and names both spellings, because a sign-out that removes nothing and
reports success is the failure worth being loud about.

**`@lankajs/react-native-async-storage`** is the engine an existing application
already has. It declares no synchronous half — nothing crossing the bridge
answers before the next tick — and it copies the library's frozen key array, so
an ordinary `keys.sort()` does not throw at a caller who never saw where the
array came from. Its name is long on purpose: `LankaAsyncStorageAdapter` beside
the port's own `ILankaAsyncStorageAdapter` would read as that interface's
implementation.

**`@lankajs/secure-store`** is the one that bends the port, and the longest for
that reason. `expo-secure-store` publishes three calls — read, write, delete — and
a sign-out needs two more. So it keeps an index of what it wrote and walks it on
`clear()`, answers `keys()` from that index, encodes keys the keychain would
refuse and decodes them on the way out, and refuses a value above roughly two
kilobytes rather than letting the platform truncate one. Truncation is the worst
available failure: half a token reads back as a whole one.

**`@lankajs/unstorage`** brings twenty-odd drivers — a filesystem, a Redis, a
Cloudflare KV, an SQL table, one you wrote — and is the only member that runs on
a server. Two things it does that the library does not:

- **the raw pair.** `getItem` deserialises, so a stored `"null"` comes back as
  `null`. Clause 1 of the port says a value returns byte for byte;
- **keys as written.** Measured over every ASCII punctuation mark against 1.17.5:
  `/` and `\` become `:`, `?` drops the rest of the key, and `a::b` and `a:b` are
  ONE row — so two keys an application means to keep apart silently merge. Those
  characters are escaped and decoded; everything else, including dots, spaces and
  underscores, passes through untouched.

Its tests drive the REAL library rather than a double, and its codec's spec
re-takes that measurement on every run, so the table cannot go stale without
something going red.

**`@lankajs/storage` did not gain `native`**, and the registry says why:
`check:runtime` refused it, correctly. Six files there name `localStorage`,
`caches` or IndexedDB unguarded. The references sit in lazy getters a device
never reaches, but a package that declares a runtime it has not been made safe
for is a promise nobody checked. Guarding them changes what happens when no
handler was passed — published behaviour, and its own change.
