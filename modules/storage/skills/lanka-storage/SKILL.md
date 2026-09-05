---
name: lanka-storage
description: Read and write browser storage, encrypt anything personal, persist a store, and keep stored data small — with @lankajs/storage. Use when saving to localStorage, sessionStorage, IndexedDB or Cache Storage; when persisting state across reloads; when personal data would otherwise sit in the clear; or when reviewing code that imports `@lankajs/storage`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/storage
    version: "2.0.0"
---

# @lankajs/storage

Three lifetimes behind one API, an encrypted twin, a persistence adapter, and two
size-reduction primitives. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Plain storage

```ts
await lankaStorage.setLocal("theme", "dark");
const theme = await lankaStorage.getLocal("theme");
const fresh = await lankaStorage.getLocal("theme", true); // bypass the memory cache
```

The same four methods per lifetime: `…Local` (until cleared), `…Session` (until
the tab closes), `…Cache`. Everything is `async`, including over `localStorage`,
so the call is the same whichever adapter is underneath.

A second key space — per tenant, or a test that must not touch the page — is a
second instance: `new LankaStorage({ local: new LankaWebStorageAdapter(localStorage) })`.

## Anything personal goes in the encrypted twin

```ts
await lankaEncryptedStorage.init(secret, "app:");
await lankaEncryptedStorage.setLocal("profile", JSON.stringify(profile));
```

Values are AES-GCM, **keys are hashed** — a key name tells you what is under it.
Same method names as `lankaStorage`.

The secret is baked into your build: it is obfuscation, not protection against
XSS on your own page. What it buys is that personal data is not sitting in
localStorage as plain text.

## Persisting a store

```ts
setLankaStorageSecret(secret); // REQUIRED, before the first read or write
persist(creator, { name: "session", storage: createJSONStorage(() => lankaEncryptedStateStorage) });
```

The ladder is two rungs: AES-GCM in localStorage, or **no persistence at all**
when Web Crypto is unavailable. There is deliberately no plaintext fallback.

`setLankaLegacyPlaintextKeys([...])` deletes an earlier plaintext implementation's
keys once, safely — encrypted records live under hashed keys.

## Keeping stored data small

```ts
const registry = createLankaIdRegistry({ persist: { save, load } });
await registry.restore();
const id = await registry.encode("a-very-long-identifier"); // 1
registry.decode(id);
```

Neither the registry nor `stringToBigInt` / `bigIntToString` is a hash: both are
reversible and collision-free, which is exactly why the registry needs
persistence. Lose the mapping and the ids mean nothing.

## Never do these

- **Never skip `setLankaStorageSecret`.** There is no default, and the storage
  refuses loudly on the first call.
- **Never read the secret from `import.meta.env` inside a library.** That is one
  bundler's global; in node it throws on first import.
- **Never add a plaintext fallback** "so it always works". That writes personal
  data in the clear and defeats the reason the storage exists.
- **Never assume a value written through one instance is visible in another.**
  Each has its own memory cache; pass `isCareful: true` or use one instance.
- **Never call `installLankaCacheStoragePolyfill()` from library code.** It
  rewrites `window.caches` for the whole page; that is the application's call.

## Symptom → cause

| What you see                                | What it is                                      |
| ------------------------------------------- | ----------------------------------------------- |
| "no encryption secret set"                  | `setLankaStorageSecret` not called first        |
| nothing persists on one device              | no `crypto.subtle` — the second rung, by design |
| a value you just wrote reads as the old one | the memory cache; pass `isCareful: true`        |
| you cannot find your key in devtools        | keys are hashed — that is intended              |
| "localStorage is not defined" in node       | something touched a browser global at import    |

## More

`reference.md` — the full guide: adapters, `LankaCipher` over any adapter, and
the whole persistence ladder.
