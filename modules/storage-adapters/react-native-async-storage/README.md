# @lankajs/react-native-async-storage

**▸ module** · AsyncStorage as a storage engine

> The engine an existing application already has installed.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** React Native.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaReactNativeAsyncStorageAdapter`, `createLankaReactNativeAsyncStorageAdapter` — the port, asynchronous only
- `ILankaReactNativeAsyncStorageEngine` — the part of AsyncStorage's surface this uses

## Why the long name

The port's asynchronous half is `ILankaAsyncStorageAdapter`, and a class called
`LankaAsyncStorageAdapter` beside it would read as that interface's implementation
rather than as a binding of one library. The names differ by an `I` and mean
different things, which is the collision worth paying four syllables to avoid.

The package binds `@react-native-async-storage/async-storage` and is named after it.

## What it does not do

`clear()` empties the WHOLE store, because AsyncStorage's does: the library has one
space per application and no namespaces. An application keeping two spaces gives
each its own key prefix and its own adapter, or uses an engine that has namespaces.
That is a property of the library, stated here rather than hidden behind a
key-prefix option this package would then have to be trusted about.

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
