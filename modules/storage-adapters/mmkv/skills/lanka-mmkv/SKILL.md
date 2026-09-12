---
name: lanka-mmkv
description: Persist values on a device with MMKV in a lanka application. Use when choosing a storage engine for React Native, when a value must be read during the first render, when wiring LankaStorage on a device, or when reviewing code that imports `@lankajs/mmkv`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/mmkv
    version: "0.0.0"
---

# @lankajs/mmkv

MMKV behind `ILankaStorageAdapter`, with both halves of the port.
`reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

Ask what reads the value.

- **Something during the first render** — a token deciding which screen to
  mount, a persisted store the UI reads before it paints. Yes: MMKV is the only
  engine here that answers without awaiting.
- **A secret** — a session token, a refresh token. Use `@lankajs/secure-store`
  as well, and put the secret there. MMKV is fast, not a keychain.
- **Anything else on a device** — preferences, a draft, a cache key. Either this
  or `@lankajs/react-native-async-storage`; take this one unless the application
  already has the other installed.
- **A server or an edge runtime** — none of the above. `@lankajs/unstorage`.

## Wiring it

```ts
import { MMKV } from "react-native-mmkv";
import { LankaStorage } from "@lankajs/storage";
import { createLankaMmkvAdapter } from "@lankajs/mmkv";

export const appStorage = new LankaStorage({
	local: createLankaMmkvAdapter(new MMKV({ id: "session" })),
});
```

`createLankaMmkvAdapter` and `new LankaMmkvAdapter(...)` are the same class; use
whichever style the project already writes.

## Three things to get right

**Pass the instance in, do not let anything construct it for you.** That is how
one application keeps several stores with different ids, and how its tests run
without a device.

**Encrypt with MMKV's own key, not with `LankaEncryptedStorage`.**

```ts
new MMKV({ id: "session", encryptionKey: secret });
```

Wrapping an already-encrypted engine costs a key derivation per read and
protects against nothing.

**Read synchronously where it matters.** `getLocalSync` is the reason this
package exists; using only the awaited calls over MMKV buys nothing that
AsyncStorage would not have given.

## Reviewing code that uses it

- A `new MMKV()` inside a module that also defines an adapter — the engine
  should arrive from the application's composition root.
- `LankaEncryptedStorage` over an MMKV instance that already has an
  `encryptionKey`.
- A first render that awaits a value it could have read now.
- A test that mocks `react-native-mmkv` with `vi.mock` — hand the adapter an
  object of `ILankaMmkvEngine`'s shape instead, or use
  `createLankaFakeStorageAdapter` from `@lankajs/tool-testing`.

## If you write your own adapter

The port is `ILankaStorageAdapter` in `lanka/storage`, eleven clauses in its
docblock. Run `lankaStorageAdapterConformance` from `@lankajs/tool-testing`
against it — the same list every package in this family answers, including the
ones a version bump might otherwise quietly break.
