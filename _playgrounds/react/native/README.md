# @lanka-playgrounds/react-native

Atlas on a device: no DOM, three storage engines, and the one that can answer on
the first frame.

## What is NOT here

The shorter list, and the more interesting one. No `@lankajs/host` — there is no
server. No blob cache, no cookies, no release guard, no server-sent events: every
one of those is a browser API, and `check:runtime` is what keeps them out of a
bundle that would have nowhere to run them.

A WebSocket IS here, because React Native has one. That is the honest line
between "a browser API" and "a web API a device also implements".

## Three engines, one store

| Lifetime  | Engine       | Why that one                                                                 |
| --------- | ------------ | ---------------------------------------------------------------------------- |
| `local`   | MMKV         | the only engine with BOTH halves of the port — it can answer during a render |
| `session` | the keychain | a token belongs behind the device's own lock                                 |
| `cache`   | AsyncStorage | the engine an application most likely already has                            |

No `LankaEncryptedStorage` over any of them: MMKV encrypts with a key given to
the instance, and a keychain is ciphertext at rest already. A second cipher costs
a key derivation per read and protects against nothing the first one missed.

## The first frame

```ts
const frame = readAtlasFirstFrame(storage); // synchronous
```

This is the whole reason `@lankajs/mmkv` is in this application. Over an awaited
engine the same code renders the sign-in screen first and the board a moment
later, which a person reads as a flash rather than as a load.

## What the tests can and cannot reach

No renderer and no device. What is left is most of it — the storage wiring, the
first frame's decision, the session, the gateways and the same ViewModels a
browser renders. Every native module is handed in rather than imported, so a
double is an object of the engine's shape; and the doubles REFUSE what the real
engines refuse — a keychain key outside its character set, a value past its size.

What proves the rest is the bundle:

```bash
pnpm --filter @lanka-playgrounds/react-native build:app
```

Metro resolving the framework, the shared package, three native modules and the
`.lanka` barrels, and compiling the lot to Hermes bytecode.

## Running it

```bash
pnpm build                                          # once: metro.config.js reads tool-di's dist
pnpm --filter @lanka-playgrounds/_server start
pnpm --filter @lanka-playgrounds/react-native start # Expo, on a device or an emulator
```
