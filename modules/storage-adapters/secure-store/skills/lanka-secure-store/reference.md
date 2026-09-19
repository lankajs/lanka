<!-- Generated from modules/storage-adapters/secure-store/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/secure-store@1.0.1`** — this document describes that version.
>
> Install: `npm install @lankajs/secure-store expo-secure-store zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/storage-adapters/secure-store/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/secure-store/_playground/playground.test.ts)

# @lankajs/secure-store — user guide

The device's keychain behind `ILankaStorageAdapter` — with the two operations
`expo-secure-store` does not have, supplied.

## You will learn

- how to put the device's keychain behind the framework's storage port
- the two operations this adapter supplies that `expo-secure-store` has not
- why your key spelling survives a keychain that accepts five characters
- what happens to a value too large for a keychain row, and why refusing is right

## When to reach for this

Reach for it for secrets, and for nothing else: a token, a refresh token, a
key. A keychain read is orders of magnitude slower than MMKV, so a preference
stored here is a cost paid on every screen.

Two engines in one `LankaStorage` is the ordinary shape on a device — this one
under `session`, `@lankajs/mmkv` under `local`.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/secure-store expo-secure-store zustand
```

> [!IMPORTANT]
> The engine is a peer dependency and this package never imports it — you build
> it and hand it in. `zustand` is `lanka`'s own peer: npm adds a missing peer
> for you and pnpm does not, so the line names all of them.

## Wire it

```ts
import * as SecureStore from "expo-secure-store";
import { LankaStorage } from "@lankajs/storage";
import { createLankaSecureStoreAdapter } from "@lankajs/secure-store";
import { createLankaMmkvAdapter } from "@lankajs/mmkv";

export const appStorage = new LankaStorage({
	// Secrets in the keychain, everything else in the fast store.
	session: createLankaSecureStoreAdapter(SecureStore),
	local: createLankaMmkvAdapter(engine),
});
```

Two engines in one storage is the ordinary shape on a device. A keychain read is
orders of magnitude slower than MMKV, so put in it only what must be there.

## What this package adds to the library

`expo-secure-store` publishes three calls: read a key, write a key, delete a key.
The port asks for two more, and a sign-out needs both.

| Port              | What this adapter does                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| `clear()`         | walks an INDEX of what it wrote, deletes each row, then the index       |
| `keys()`          | answers that index, so a caller sees the namespace and not the keychain |
| a key as given    | encodes on the way in, decodes on the way out                           |
| a value that fits | refuses above roughly 2 KB rather than letting the platform truncate    |

The index is one extra keychain write per operation. That is the price of
`clear()` being true: without it, a sign-out could only delete keys the caller
happened to name, and a token some earlier screen wrote would outlive the session.

## Keys, and why yours are fine

A keychain accepts only letters, digits, `.`, `-` and `_`. Your application does
not have to know that:

```ts
await appStorage.setSession("auth.access token", token);

// Read back under the name it was written with, always.
await appStorage.getSession("auth.access token");
```

On the device that row is stored as `row.auth.access_0020token`. `keys()`
answers `"auth.access token"`, because the spelling a caller wrote is the
spelling it gets back.

The `row.` in front is not decoration. This adapter keeps an index under a key of
its own, and without a prefix an application writing the key
`lanka.secure-store.index` — a coincidence, a copied constant — would write over
that index. Every secret stored before that moment would become invisible to
`clear()`, and the sign-out would report success. With the prefix the collision
cannot be expressed: your keys live in one space and the index outside it.

## Values, and the one that will not fit

```ts
await adapter.setItem("auth.token", enormous); // rejects
```

A keychain row holds about two kilobytes and the platform truncates rather than
refusing. Truncation is the worst available failure — half a token reads back as
a whole one and decrypts to nothing a week later — so the adapter refuses first
and names the size. Store the value elsewhere and keep its address here.

**Do not put `LankaEncryptedStorage` over this.** The keychain is already
ciphertext at rest, protected by the device's own lock. A second cipher costs a
key derivation per read and protects against nothing the first one missed.

## Testing over it

`expo-secure-store` does not run in node. Hand the adapter an object of the
engine's shape — and make the double **refuse** what a keychain refuses, or the
test proves nothing about the device:

```ts
import type { ILankaSecureStoreEngine } from "@lankajs/secure-store";

const rows = new Map<string, string>();
const keychain: ILankaSecureStoreEngine = {
	getItemAsync: async (key) => {
		if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new Error(`Invalid key provided: ${key}`);
		return rows.get(key) ?? null;
	},
	// …setItemAsync and deleteItemAsync, refusing the same way
};
```

When the test is about code above the port, use `createLankaFakeStorageAdapter`
from `@lankajs/tool-testing` instead.

## Which member of the family

| You need                                           | Install                               |
| -------------------------------------------------- | ------------------------------------- |
| a token behind the device's own lock               | `@lankajs/secure-store`               |
| speed, and an answer on the first frame            | `@lankajs/mmkv`                       |
| the engine the app already has                     | `@lankajs/react-native-async-storage` |
| a server, an edge runtime, or a driver of your own | `@lankajs/unstorage`                  |

## Recap

- Hand `expo-secure-store` in; the adapter never imports it.
- `clear()` and `keys()` are this package's own, built on an index it maintains — one extra keychain write per operation, and the price of a sign-out that is true.
- Your keys are stored encoded and answered back exactly as written, under a `row.` prefix that makes a collision with the index impossible to express.
- A value above roughly 2 KB is refused by name, because the platform would truncate it instead and half a token reads back as a whole one.
- Do not put `LankaEncryptedStorage` over this: the keychain is already ciphertext behind the device's own lock.
- A test double must REFUSE what a keychain refuses, or the test proves nothing about the device.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/secure-store/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/secure-store/README.md) · Repository map: [../../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
