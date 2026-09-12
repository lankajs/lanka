---
name: lanka-secure-store
description: Keep tokens and secrets in the device keychain in a lanka application. Use when storing a session or refresh token on a device, when a sign-out must remove everything it wrote, when choosing where a secret lives, or when reviewing code that imports `@lankajs/secure-store`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/secure-store
    version: "0.0.0"
---

# @lankajs/secure-store

The device keychain behind `ILankaStorageAdapter`, with `clear()` and `keys()`
supplied. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

For **secrets**, yes: a session token, a refresh token, anything held on the
user's behalf. The keychain is protected by the device's own lock and survives
where a key-value file does not.

For anything else, no. A keychain read is far slower than MMKV, and a row holds
about two kilobytes. Preferences, drafts and caches belong in `@lankajs/mmkv` or
`@lankajs/react-native-async-storage` — most applications install two engines and
split by meaning.

## Wiring it

```ts
import * as SecureStore from "expo-secure-store";
import { LankaStorage } from "@lankajs/storage";
import { createLankaSecureStoreAdapter } from "@lankajs/secure-store";

export const appStorage = new LankaStorage({
	session: createLankaSecureStoreAdapter(SecureStore),
	local: createLankaMmkvAdapter(engine),
});
```

## What this package does that the library cannot

- **`clear()` works.** It keeps an index of what it wrote and walks it, so a
  sign-out removes tokens nobody remembered to name.
- **`keys()` answers.** The keychain cannot be enumerated; the index can.
- **Your key spellings survive.** A keychain takes only letters, digits, `.`, `-`
  and `_`; the adapter encodes and decodes so `"auth.access token"` is what you
  wrote and what you get back.
- **An oversized value is refused**, not truncated by the platform into something
  that reads back as whole.

## Three things to get right

**Do not encrypt on top of it.** `LankaEncryptedStorage` over a keychain is a
second lock on one door — a key derivation per read, protecting against nothing.

**Do not put large values in it.** A row is about 2 KB. Keep the value elsewhere
and the address here.

**Do not name keys around the keychain's restrictions.** Name them for your
application; the adapter handles the rest.

## Reviewing code that uses it

- A preference, a draft or a cache written into the keychain.
- `LankaEncryptedStorage` wrapping this adapter.
- A sign-out that removes tokens one by one — `clear()` is the whole point of the
  index.
- A test whose keychain double accepts any key. The real one refuses, and a
  permissive double hides the encoding this package exists for.
- A value whose size is not bounded by anything before it is stored.

## If you write your own adapter

The port is `ILankaStorageAdapter` in `lanka/storage`, eleven clauses in its
docblock — clauses 5, 6, 7, 10 and 11 are the ones this engine made necessary.
Run `lankaStorageAdapterConformance` from `@lankajs/tool-testing` against it, with
`maxValueBytes` if your engine has a ceiling.
