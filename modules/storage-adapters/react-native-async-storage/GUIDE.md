# Using `@lankajs/react-native-async-storage`

`@react-native-async-storage/async-storage` behind `ILankaStorageAdapter` — the
engine a React Native application most likely already has.

## Install

```sh
pnpm add @lankajs/react-native-async-storage @react-native-async-storage/async-storage
```

The library is a peer dependency and this package never imports it.

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
	void appStorage.getLocal("preferences.theme").then(/* … */);
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

| You need | Install |
| --- | --- |
| the engine the app already has | `@lankajs/react-native-async-storage` |
| an answer during the first render | `@lankajs/mmkv` |
| a token behind the device's own lock | `@lankajs/secure-store` |
| a server, an edge runtime, or a driver of your own | `@lankajs/unstorage` |

Moving from this package to `@lankajs/mmkv` changes which adapter is constructed
and nothing above it — that is what the port is for.
