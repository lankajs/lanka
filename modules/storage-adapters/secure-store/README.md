# @lankajs/secure-store

**▸ module** · The keychain as a storage engine

> The one that bends the port: no wipe, no enumeration, two kilobytes, and a restricted key.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** React Native.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaSecureStoreAdapter`, `createLankaSecureStoreAdapter` — the port over the keychain
- `ILankaSecureStoreEngine` — the three calls `expo-secure-store` publishes

## Three clauses this engine cannot keep by itself

`expo-secure-store` deletes a key it is handed and offers nothing else. No wipe, no
list of what it holds, keys limited to letters, digits, `.`, `-` and `_`, and values
of roughly two kilobytes. The port asks for more than that, and the adapter is where
the difference is paid rather than in every caller:

| Clause | What this adapter does |
| --- | --- |
| 5, 7 — `clear()` empties what was written | keeps an INDEX of its own keys, and wipes by walking it |
| 6 — `keys()` answers what was written | the index again, so the answer is the namespace's and not the keychain's |
| 11 — a key is used as given | encodes on the way in and DECODES on the way out, so a caller never sees a key it did not write |
| 10 — a value the engine cannot hold fails | refuses over the ceiling instead of letting the platform truncate |

The index is a row in the keychain like any other, under a key of this package's own.
It is written on every set and remove, which is one extra write per operation — the
price of `clear()` being true. An engine that could enumerate would not pay it, and
none of the others do.

## Why the ceiling is refused rather than split

Splitting a large value across rows would make this package a filesystem with a
keychain underneath, and the failure it hides is worse than the one it prevents: half
a token read back as a whole one. A session token fits in two kilobytes; a value that
does not is a value that does not belong in a keychain.

## The engine is handed in, never constructed

The adapter takes the engine as a parameter — the shape `new LankaWebStorageAdapter(localStorage)`
has had since the beginning — and imports the library nowhere. Three things follow, and the
third is the reason:

- the package has no runtime dependency on the vendor, so an application pays for what it
  installed and nothing else;
- a second instance with its own namespace is the application's to make, which is what a
  per-tenant store or a test that must not touch the page's keys needs;
- **it is testable off the device.** A native module cannot run in node, so an adapter that
  reached for the library itself could only be tested by the application that shipped it.
  The engine's surface is declared here as a type, and the conformance suite runs against a
  double of it — which is also what proves the declared shape is the shape the library has.

---

Repository map: [../../../README.md](../../../README.md)
