<!-- Generated from modules/storage-adapters/mmkv/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/mmkv@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/mmkv react react-native-mmkv zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/storage-adapters/mmkv/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/mmkv/_playground/playground.test.ts)

# Using `@lankajs/mmkv`

MMKV behind `ILankaStorageAdapter`, with both halves of the port — which makes
it the only engine on a device that can answer during the first render.

## Install

```sh
pnpm add @lankajs/mmkv react-native-mmkv
```

`react-native-mmkv` is a peer dependency and this package never imports it. Both
majors work: v3, and v4 under Nitro.

## Wire it

```ts
import { MMKV } from "react-native-mmkv";
import { LankaStorage } from "@lankajs/storage";
import { createLankaMmkvAdapter } from "@lankajs/mmkv";

const engine = new MMKV({ id: "session" });

export const appStorage = new LankaStorage({
	local: createLankaMmkvAdapter(engine),
});
```

Under v4 the instance is built by `createMMKV()` instead; nothing else changes,
because the adapter asks the instance which delete it has rather than reading a
version.

The class is there for a project that writes classes:

```ts
import { LankaMmkvAdapter } from "@lankajs/mmkv";

const adapter = new LankaMmkvAdapter(engine);
```

Both reach the same class, so a behaviour cannot arrive at one and not the other.

## What it is for

The first frame. A device application decides which screen to mount before it
renders anything, and an engine that must be awaited has not answered by then:

```ts
const token = appStorage.getLocalSync("session.token");

// Decided, not guessed — and not corrected a tick later.
const screen = token === null ? "sign-in" : "feed";
```

Written over an awaited engine, that same code renders the sign-in screen first
and the feed a moment after, which a user reads as a flash rather than as a load.

## What it does not do

**It does not encrypt.** MMKV does, with a key you pass to the instance:

```ts
const engine = new MMKV({ id: "session", encryptionKey: secret });
```

That is the right place for it on a device. Putting `LankaEncryptedStorage` over
an already-encrypted engine is a second lock on one door — it costs a key
derivation per read and protects against nothing the first one missed.

**It does not create the engine.** You do, which is what lets one application
keep several instances with different ids, and what makes the adapter testable
off a device.

**It has no size ceiling.** MMKV holds what you give it; if a value belongs in a
keychain instead, that is `@lankajs/secure-store`.

**It does refuse, though.** A full disk or an encryption key that no longer opens
the file makes MMKV throw. The synchronous methods throw, and the awaited ones
REJECT — so `catch` works the way the signature says, in both styles.

## Testing over it

Nothing native runs in node, so hand the adapter an object of the engine's
shape — `ILankaMmkvEngine` is exported for exactly that — or use the kit's
`createLankaFakeStorageAdapter` when the test is about the code above the port
rather than about MMKV.

```ts
import type { ILankaMmkvEngine } from "@lankajs/mmkv";

const rows = new Map<string, string>();
const engine: ILankaMmkvEngine = {
	getString: (key) => rows.get(key),
	set: (key, value) => void rows.set(key, value),
	remove: (key) => void rows.delete(key),
	clearAll: () => rows.clear(),
	getAllKeys: () => [...rows.keys()],
};
```

An adapter you write yourself — over an engine nobody here has heard of — is held
to the same list: `lankaStorageAdapterConformance` from `@lankajs/tool-testing`
is published for that.

## Which member of the family

| You need | Install |
| --- | --- |
| speed, and an answer on the first frame | `@lankajs/mmkv` |
| a token behind the device's own lock | `@lankajs/secure-store` |
| the engine the app already has | `@lankajs/react-native-async-storage` |
| a server, an edge runtime, or a driver of your own | `@lankajs/unstorage` |

The first two are installed together more often than either is installed alone:
preferences in MMKV, tokens in the keychain.
