<!-- Generated from modules/storage-adapters/react-native-async-storage/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/react-native-async-storage@1.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/react-native-async-storage @react-native-async-storage/async-storage zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/storage-adapters/react-native-async-storage/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/react-native-async-storage/_playground/playground.test.ts)

# @lankajs/react-native-async-storage — user guide

`@react-native-async-storage/async-storage` behind `ILankaStorageAdapter` — the
engine a React Native application most likely already has.

## You will learn

- how to put AsyncStorage behind the framework's storage port, in either style
- why nothing here can answer during the first render, and how to write that honestly
- what `clear()` takes with it, and how to keep two key spaces apart
- how to test the code above it without a device

## When to reach for this

Reach for it when the application already has AsyncStorage and you would
rather not add a second engine. It is the ordinary choice, and the one with the
least to install.

Reach for `@lankajs/mmkv` instead when something must be decided before the
first frame: every call here crosses the bridge, so the earliest it can answer is
the next tick. Moving between the two changes which adapter is constructed and
nothing above it.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/react-native-async-storage @react-native-async-storage/async-storage zustand
```

> [!IMPORTANT]
> The engine is a peer dependency and this package never imports it — you build
> it and hand it in. `zustand` is `lanka`'s own peer: npm adds a missing peer
> for you and pnpm does not, so the line names all of them.

## Wire it

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LankaStorage } from "@lankajs/storage";
import { createLankaReactNativeAsyncStorageAdapter } from "@lankajs/react-native-async-storage";

export const appStorage = new LankaStorage({
	local: createLankaReactNativeAsyncStorageAdapter(AsyncStorage),
});
```

The class is there for a project that writes classes:

```ts
import { LankaReactNativeAsyncStorageAdapter } from "@lankajs/react-native-async-storage";

const adapter = new LankaReactNativeAsyncStorageAdapter(AsyncStorage);
```

## What it cannot do, and what to do instead

**Nothing here answers before the next tick.** Everything AsyncStorage does
crosses the bridge, so a value cannot be read during the first render. Write the
honest version:

```tsx
const [boot, setBoot] = useState<IBoot>({ screen: "splash" });

useEffect(() => {
	void (appStorage.getLocal("preferences.theme").then(/* … */));
}, []);
```

A splash for one tick reads as a load. Rendering the app with defaults and
correcting it when the store answers reads as a flash — and that is the
difference `@lankajs/mmkv` exists to remove.

**`clear()` empties everything.** AsyncStorage has one space per application and
no namespaces, so a sign-out that calls `clear()` takes the preferences with it.
Two spaces mean two engines, or two key prefixes the application owns:

```ts
await Promise.all(["session.token", "session.refresh"].map((key) => appStorage.removeLocal(key)));
```

**It does not encrypt.** Values are plaintext on the device. A token belongs in
`@lankajs/secure-store`; for anything else, `LankaEncryptedStorage` over this
adapter is the ordinary answer — the engine has no encryption of its own to
duplicate.

## Testing over it

A native module does not run in node. Hand the adapter an object of the engine's
shape — `ILankaReactNativeAsyncStorageEngine` is exported for that — and
remember that the real `getAllKeys` answers a **readonly** array:

```ts
import type { ILankaReactNativeAsyncStorageEngine } from "@lankajs/react-native-async-storage";

const rows = new Map<string, string>();
const engine: ILankaReactNativeAsyncStorageEngine = {
	getItem: (key) => Promise.resolve(rows.get(key) ?? null),
	setItem: async (key, value) => void rows.set(key, value),
	removeItem: async (key) => void rows.delete(key),
	clear: async () => rows.clear(),
	getAllKeys: () => Promise.resolve(Object.freeze([...rows.keys()])),
};
```

The adapter copies that array on the way out, so `(await adapter.keys()).sort()`
is safe — which it would not be if the library's own array were handed on.

When the test is about the code above the port rather than about AsyncStorage,
use `createLankaFakeStorageAdapter` from `@lankajs/tool-testing` instead.

## Which member of the family

| You need                                           | Install                               |
| -------------------------------------------------- | ------------------------------------- |
| the engine the app already has                     | `@lankajs/react-native-async-storage` |
| an answer during the first render                  | `@lankajs/mmkv`                       |
| a token behind the device's own lock               | `@lankajs/secure-store`               |
| a server, an edge runtime, or a driver of your own | `@lankajs/unstorage`                  |

Moving from this package to `@lankajs/mmkv` changes which adapter is constructed
and nothing above it — that is what the port is for.

## Recap

- Hand the library in; the adapter never imports it, which is what keeps it testable off a device.
- Only the asynchronous half of the port is filled — there is no synchronous read to be had, and a splash for one tick is the honest shape.
- `clear()` empties the whole application space: keep sessions and preferences apart by prefix, or by a second engine.
- Nothing here encrypts. A token belongs in `@lankajs/secure-store`; for the rest, `LankaEncryptedStorage` over this adapter is the ordinary answer.
- The library's `getAllKeys` answers a readonly array and the adapter copies it, so sorting the result is safe.
- Test over an `ILankaReactNativeAsyncStorageEngine` double, or over `createLankaFakeStorageAdapter` when the test is about the code above the port.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/react-native-async-storage/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/react-native-async-storage/README.md) · Repository map: [../../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
