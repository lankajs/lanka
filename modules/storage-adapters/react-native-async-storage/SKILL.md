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

## What to run

```sh
pnpm --filter @lankajs/react-native-async-storage test
pnpm check
```
