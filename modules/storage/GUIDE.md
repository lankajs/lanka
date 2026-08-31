# @lankajs/storage — user guide

Browser storage behind one API: local, session and cache; an encrypted variant
for anything personal; a zustand persistence adapter; and two small pieces that
keep stored data small — a string ↔ id registry and a reversible string ↔ bigint
codec.

## You will learn

- the three lifetimes behind one API, and when each is right
- what the encrypted twin buys and what it does not
- how a persisted store degrades when the platform has no crypto
- two ways to keep stored data small

## When to reach for this

Reach for it when something must survive a reload, and reach for the encrypted
twin the first time that something is personal. A value that lives as long as a
screen belongs in a ViewModel, not here.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/storage
```

## The plain store

```ts
import { lankaStorage } from "@lankajs/storage";

await lankaStorage.setLocal("theme", "dark");
const theme = await lankaStorage.getLocal("theme");
await lankaStorage.removeLocal("theme");
await lankaStorage.clearLocal();
```

The same six methods exist for each lifetime:

| Lifetime | Methods                                                  | Lives until          |
| -------- | -------------------------------------------------------- | -------------------- |
| local    | `setLocal` `getLocal` `removeLocal` `clearLocal`         | cleared              |
| session  | `setSession` `getSession` `removeSession` `clearSession` | the tab closes       |
| cache    | `setCache` `getCache` `removeCache` `clearCache`         | the cache is evicted |

Everything is `async`, including over `localStorage`, so the same call works
whichever adapter is underneath.

Reads go through an in-memory cache. Pass `isCareful: true` to bypass it and read
the medium itself:

```ts
const fresh = await lankaStorage.getLocal("theme", true);
```

### A second key space

`lankaStorage` is the ambient instance and is what an application writes. Build
your own when you need a different **space** — a per-tenant store, or a test that
must not touch what the page wrote:

```ts
import { LankaStorage, LankaWebStorageAdapter } from "@lankajs/storage";

const tenantStorage = new LankaStorage({
	local: new LankaWebStorageAdapter(localStorage),
});
```

### Adapters

| Adapter                    | Over                              |
| -------------------------- | --------------------------------- |
| `LankaWebStorageAdapter`   | `localStorage` / `sessionStorage` |
| `LankaIndexedDbAdapter`    | IndexedDB                         |
| `LankaCacheStorageAdapter` | Cache Storage                     |

Write your own by implementing `ILankaStorageAdapter`. Add `setItemSync` /
`getItemSync` / `removeItemSync` to make it synchronously capable; the store asks
before using them, so an adapter without them is not broken, just async-only.

## Encrypted storage

For anything personal. Values are encrypted with AES-GCM and **keys are hashed**
with SHA-256 — a key name in storage tells you what is stored under it, so
leaving it in the clear leaves half the information outside.

```ts
import { lankaEncryptedStorage } from "@lankajs/storage";

await lankaEncryptedStorage.init(secret, "app:");
await lankaEncryptedStorage.setLocal("profile", JSON.stringify(profile));
```

The API mirrors `lankaStorage` exactly.

Understand what the secret buys: it is baked into your build, so it is
**obfuscation, not protection against XSS on your own page**. What it does is
keep personal data from sitting in localStorage as plain text.

## Persisting a store

```ts
import { setLankaStorageSecret, lankaEncryptedStateStorage } from "@lankajs/storage";
import { persist, createJSONStorage } from "zustand/middleware";

setLankaStorageSecret(import.meta.env.VITE_STORAGE_SECRET);

persist(creator, {
	name: "session",
	storage: createJSONStorage(() => lankaEncryptedStateStorage),
});
```

**You must set the secret before the first read or write.** There is deliberately
no default: a shipped fallback secret is the absence of encryption disguised as
its presence, shared by every consumer of the package. Without it, the storage
refuses loudly.

It is not read from `import.meta.env` either — that is one bundler's global.
In node it is `undefined` and reading a property off it throws on first import;
a webpack consumer would fail the same way.

### The persistence ladder

1. **AES-GCM in localStorage** — the normal path.
2. **No persistence at all** — when Web Crypto is unavailable (`crypto.subtle`
   needs a secure context, and some WebViews withhold it) or a storage call
   fails. The persisted slice then lives only in memory for that run.

Falling back to **plaintext** localStorage is deliberately not an option: it
would silently write personal data in the clear, defeating the reason the storage
exists. Losing the convenience is acceptable; losing the property is not.

Every method swallows its failures, because zustand's `persist` turns a rejection
during hydration into an unhandled rejection — which reads as a crash on a device
whose only problem is "no crypto".

### Cleaning up an earlier plaintext implementation

```ts
setLankaLegacyPlaintextKeys(["user", "token"]);
```

Those keys are deleted from localStorage once, when encrypted storage first
becomes ready. It is safe: encrypted records live under hashed keys, so these
names cannot touch one.

## Encrypting any adapter

```ts
import { createLankaCipher } from "@lankajs/storage";

const secure = await createLankaCipher(adapter, "secret", true);
await secure.setItem("token", "12345");
const value = await secure.getItem("token");
```

`LankaCipher` (and its factory) wraps **any** adapter, so encryption does not
know where it writes. With encryption disabled it writes values as-is, which
makes it easy to compare the two in a test. `LankaEncryptor` /
`createLankaEncryptor` is the primitive underneath if you only need the crypto.

## Keeping stored data small

### A string ↔ id registry

```ts
import { createLankaIdRegistry } from "@lankajs/storage";

const registry = createLankaIdRegistry({
	persist: {
		save: (snapshot) => lankaStorage.setLocal("ids", JSON.stringify(snapshot)),
		load: async () => JSON.parse((await lankaStorage.getLocal("ids")) ?? "null"),
	},
});

await registry.restore();
const id = await registry.encode("a-very-long-room-identifier"); // 1
registry.decode(id); // "a-very-long-room-identifier"
```

**It is not a hasher.** Nothing is computed: an id comes from a counter and is
_stored_. Without the stored mapping the number means nothing — which is exactly
why the registry has persistence and a hash could not.

Use it when the same long strings appear thousands of times in something you keep
(a read-marks set, an offline queue).

### A reversible string ↔ bigint codec

```ts
import { stringToBigInt, bigIntToString } from "@lankajs/storage";

const packed = stringToBigInt("room-42"); // reversible, collision-free
bigIntToString(packed); // "room-42"
```

Also not a hash: the bytes are packed into the number and the length is written
as the high field, which is how the decoder knows how many bytes to read. The
number grows linearly with the input, so this is for **short** strings — keys,
names, identifiers.

## Cache Storage where it is missing

```ts
import { installLankaCacheStoragePolyfill } from "@lankajs/storage";

installLankaCacheStoragePolyfill();
```

A function you call rather than code that runs on import. Importing a module must
not silently rewrite `window.caches` for the whole page, must not make
`sideEffects: false` untrue, and must not throw `window is not defined` in node.
The decision belongs to the application.

## Common mistakes

**Forgetting `setLankaStorageSecret`.** The storage refuses on the first call.
That is the design; there is no default.

**Expecting encrypted values to be readable in devtools.** Keys are hashed too —
you will not find the name you wrote.

**Reading a value you just wrote through another instance.** Each store has its
own memory cache. Pass `isCareful: true`, or use one instance.

**Treating the id registry as a hash.** Lose the mapping and the ids mean
nothing. Persist it, and call `restore()` on start.

## Recap

- Everything is `async`, including over `localStorage`, so one call works whichever adapter is underneath.
- Encrypted storage hashes keys as well as values — a key name tells you what is under it.
- `setLankaStorageSecret` is required and has no default; a shipped fallback secret is the absence of encryption disguised as its presence.
- The persistence ladder has two rungs: AES-GCM, or nothing. Plaintext is deliberately not a fallback.
- The id registry and the bigint codec are **not** hashes — they are reversible, which is why the registry needs persistence.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Repository map: [../../README.md](../../README.md)
