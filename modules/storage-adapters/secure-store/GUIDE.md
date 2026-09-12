# Using `@lankajs/secure-store`

The device's keychain behind `ILankaStorageAdapter` — with the two operations
`expo-secure-store` does not have, supplied.

## Install

```sh
pnpm add @lankajs/secure-store expo-secure-store
```

`expo-secure-store` is a peer dependency and this package never imports it.

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

| Port | What this adapter does |
| --- | --- |
| `clear()` | walks an INDEX of what it wrote, deletes each row, then the index |
| `keys()` | answers that index, so a caller sees the namespace and not the keychain |
| a key as given | encodes on the way in, decodes on the way out |
| a value that fits | refuses above roughly 2 KB rather than letting the platform truncate |

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

On the device that row is stored as `auth.access_0020token`. `keys()` answers
`"auth.access token"`, because the spelling a caller wrote is the spelling it
gets back.

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

| You need | Install |
| --- | --- |
| a token behind the device's own lock | `@lankajs/secure-store` |
| speed, and an answer on the first frame | `@lankajs/mmkv` |
| the engine the app already has | `@lankajs/react-native-async-storage` |
| a server, an edge runtime, or a driver of your own | `@lankajs/unstorage` |
