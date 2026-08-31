# Maintaining `@lankajs/storage`

Browser storage and encryption: three lifetimes behind one API, an encrypted
twin, a zustand persistence adapter, adapters for Web Storage / IndexedDB / Cache
Storage, and two size-reduction primitives.

This is the package where a mistake is invisible in every test and visible in
production, because the environment is what varies: node has no `localStorage`,
some WebViews withhold `crypto.subtle`, and jsdom has everything.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/logger` and nothing else from this repository.
- It knows nothing about what is stored. No domain keys, no application schema.

## Invariants

1. **Nothing touches a browser global at import time.** Handlers are created on
   first use, and the Cache Storage polyfill is a function the application calls.
   Static field initialisers run on module import and touch `localStorage`, so
   the package would throw "localStorage is not defined" in node from an `import`
   alone. **No vitest run catches this** — jsdom is always there. What catches it
   is `verify:build`, which installs the tarball into a temporary project and
   runs it in plain node.

2. **There is no default encryption secret.** A shipped fallback is the absence
   of encryption disguised as its presence, shared by every consumer.
   `setLankaStorageSecret` is required and the refusal is loud.

3. **The secret does not come from `import.meta.env`.** That is one bundler's
   global; in node it is `undefined` and reading a property off it throws on
   first import, and a webpack consumer fails the same way.

4. **The persistence ladder has two rungs, never three.** AES-GCM in
   localStorage, or nothing. Falling back to plaintext would silently write
   personal data in the clear and defeat the reason the storage exists. Losing
   the convenience is acceptable; losing the property is not.

5. **`LankaEncryptedStateStorage` swallows its failures.** zustand's `persist`
   turns a rejection during hydration into an unhandled rejection, which reads as
   a crash on a device whose only problem is "no crypto". The `init` memo is part
   of this: the storage's own ready flag flips only after async setup resolves,
   so without the memo a burst of hydration reads re-initialises.

6. **Keys are hashed, not only values.** A key name tells you what is stored
   under it. Encrypting the value alone leaves half the information outside.

7. **The id registry and the bigint codec are not hashes, and the docs must keep
   saying so.** The registry stores a counter-assigned mapping; the codec packs
   bytes with a length field. Both are reversible and collision-free _because_
   they are not hashes, which is the property a caller depends on.

8. **`has`/`!== undefined`, never truthiness, around ids.** `startId: 0` is a
   legal start and id `0` is an ordinary id. A truthiness check mints a second id
   for a string that already has one, leaving two records for one value.

9. **A sync capability is asked for, not assumed.** `supportsSyncStorage`
   narrows; an adapter without the sync trio is async-only, not broken.

## Tests and coverage

Beside each unit, plus the `_playground/` scenes — a session that survives a
reload, per-tenant storage, secret notes, read marks, and a memory adapter. The
three lifetimes are three separate files there on purpose: picking the wrong one
should be a visible import rather than a character in a method name.

Coverage is a ratchet: statements 81, branches 92, functions 85, lines 81. The
statement figure is low because whole adapters are environment-specific; raise it
by testing them against fakes, never by excluding them.

**A jsdom test cannot prove this package imports cleanly.** When you touch module
initialisation, `pnpm run verify:build` is the check that matters.

## Performance

`LankaIdRegistry.bench.ts`; baseline in `perf/storage.perf.md`, in yardsticks.
Hashing and decryption cost measurably, which is why `LankaCipher` caches keys
and values in memory — measure before removing that.

## Before you finish

```bash
pnpm --filter @lankajs/storage test
pnpm --filter @lankajs/storage test:coverage
pnpm run verify:build
pnpm check
```

## Traps

**Adding a convenience that runs at import.** See invariant 1. Every version of
this mistake passes the whole test suite.

**Making the encrypted storage "resilient" by writing plaintext on failure.**
That is invariant 4, and it is the one change in this package that would be a
privacy incident rather than a bug.

**Testing crypto only where `crypto.subtle` exists.** The interesting path is the
one where it does not. `isWebCryptoAvailable()` is mockable; use it.

**Assuming one instance.** `lankaStorage` is ambient, but the class is public
because a second key space is a real need. Anything you add must work for the
second instance too — that is why the state is instance-level and not static.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
