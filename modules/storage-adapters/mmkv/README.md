# @lankajs/mmkv

**▸ module** · MMKV as a storage engine

> The only engine that fills the synchronous half on a device.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** React Native.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaMmkvAdapter`, `createLankaMmkvAdapter` — `ILankaStorageAdapter`, both halves
- `ILankaMmkvEngine` — the part of MMKV's surface this uses, as a type

## Why this one first

MMKV answers without awaiting, and it is the only engine on a device that does. A
persisted store read during the first render either has its value or it does not:
an engine that must be awaited renders once without the value and again with it,
which a user reads as a flash rather than as a load.

## Two majors, told apart by shape

v4 moved to Nitro and renamed the constructor (`new MMKV()` → `createMMKV()`) and
the delete (`.delete()` → `.remove()`), and it requires React Native 0.75. v3 is
what most applications have installed today.

The adapter never constructs the engine, so the constructor's name is the
application's problem and not this package's. What IS this package's problem is the
one method that changed: it asks the instance which it has. A version range would
have been a guess about what the consumer installed; a question to the object is an
answer about what it actually is — the same reasoning `@lankajs/any-schema` uses to
tell schema dialects apart.

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
