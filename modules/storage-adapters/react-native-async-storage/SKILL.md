# Maintaining `@lankajs/react-native-async-storage`

The thinnest member of its family: five calls onto five calls. What matters here
is resisting the urge to make it thicker.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/storage` for types and **nothing else**. The library is a
  peer dependency and is never imported.
- A member of `modules/storage-adapters/`, so its surface differs from its
  siblings' in exactly one place: the vendor's name.

## Invariants

1. **The long name is deliberate.** `LankaAsyncStorageAdapter` would sit beside
   `ILankaAsyncStorageAdapter` — the port's asynchronous half — and read as its
   implementation. Two names differing by an `I` and meaning different things is
   the collision the four extra syllables buy off. Do not shorten it.

2. **No synchronous half.** Nothing crossing the bridge answers before the next
   tick, and declaring the four methods anyway would be a lie clause 8 is written
   to catch. An application that needs one installs `@lankajs/mmkv`.

3. **`keys()` copies.** The library answers a frozen array; handing it on makes
   an ordinary `keys.sort()` throw at a caller who never saw where the array came
   from.

4. **No key prefix option.** `clear()` empties the application's whole space
   because the LIBRARY has one space. A prefix option here would be this package
   asking to be trusted about a namespace it cannot enforce — the guide states
   the property instead, and an application that needs two spaces uses two
   engines.

5. **No encryption.** Unlike MMKV this engine has none, so
   `LankaEncryptedStorage` over it is the ordinary answer rather than a second
   lock. Nothing to add here.

## The playground

The engine double answers a tick late on purpose. A double that resolved
immediately would let a scene be written that a device cannot run — and the
splash-then-screen shape is the whole point of the member.

## Tests and coverage

Beside each unit, plus the playground scene in `_playground/`, whose engine
double answers a tick late on purpose.

The port's own list is `lankaStorageAdapterConformance` from
`@lankajs/tool-testing`, and it is what `check:family` requires every member of
this shelf to run. A behaviour that belongs to the PORT is proved by adding a
scene there, where all four members answer it; only what is AsyncStorage's
belongs in a test here.

Coverage is a ratchet: add the missing test, never lower a threshold.

## Before you finish

```bash
pnpm --filter @lankajs/react-native-async-storage test
pnpm --filter @lankajs/react-native-async-storage test:coverage
node scripts/check-api.mjs
node scripts/check-family.mjs
pnpm check
```

## Traps

**Filling the synchronous half.** There is nothing to fill it with — every call
crosses the bridge. A synchronous method that answers a stale cache would make
the port lie for every member.

**Copying `getAllKeys` straight out.** The library answers a readonly array, and
a caller that sorts the result would mutate the library's own.

**Adding encryption here.** The engine has none of its own to duplicate, so
`LankaEncryptedStorage` over this adapter is the answer — in the application,
not in this package.

**A feature that would also make sense in another member.** It belongs to the
port, in `@lankajs/storage`, where all four get it.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
