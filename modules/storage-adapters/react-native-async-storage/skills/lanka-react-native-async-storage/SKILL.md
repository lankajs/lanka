---
name: lanka-react-native-async-storage
description: Persist values on a device with AsyncStorage in a lanka application. Use when a React Native app already has @react-native-async-storage/async-storage, when wiring LankaStorage on a device, when a sign-out must clear stored values, or when reviewing code that imports `@lankajs/react-native-async-storage`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/react-native-async-storage
    version: "0.0.0"
---

# @lankajs/react-native-async-storage

AsyncStorage behind `ILankaStorageAdapter`. `reference.md` beside this file is
the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

Take it when the application **already has the library**. It is the engine most
React Native projects reached for first, and this package is how that keeps
working while everything above it is written against the port.

Starting fresh, take `@lankajs/mmkv` instead: it answers during the first render
and this cannot. Either way, a secret belongs in `@lankajs/secure-store`.

## Wiring it

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LankaStorage } from "@lankajs/storage";
import { createLankaReactNativeAsyncStorageAdapter } from "@lankajs/react-native-async-storage";

export const appStorage = new LankaStorage({
	local: createLankaReactNativeAsyncStorageAdapter(AsyncStorage),
});
```

## Two properties that decide how code above it is written

**Nothing answers before the next tick.** A screen that depends on a stored value
renders a splash first and the real screen when the value arrives. Writing it the
other way — defaults now, correction later — is a visible flash.

**`clear()` empties the whole space.** The library has one space per application
and no namespaces. A sign-out that calls it takes preferences and caches with it;
remove the session's keys by name instead, or keep sessions in a second engine.

## Reviewing code that uses it

- A first render that assumes a stored value is already there.
- `appStorage.clearLocal()` on sign-out where only the session was meant.
- A token written here rather than into `@lankajs/secure-store`.
- `vi.mock("@react-native-async-storage/async-storage")` in a test — hand the
  adapter an object of `ILankaReactNativeAsyncStorageEngine`'s shape instead, or
  use `createLankaFakeStorageAdapter` from `@lankajs/tool-testing`.
- A double whose `getAllKeys` answers a mutable array. The real one is frozen,
  and a test over a permissive double proves less than it looks.

## If you write your own adapter

The port is `ILankaStorageAdapter` in `lanka/storage`, eleven clauses in its
docblock. Run `lankaStorageAdapterConformance` from `@lankajs/tool-testing`
against it — the same list every package in this family answers.
