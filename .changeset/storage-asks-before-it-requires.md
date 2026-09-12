---
"@lankajs/storage": minor
---

`@lankajs/storage` runs where the framework does: browser, node, native

The package declared `browser` and the adapters a device needs now exist, so the
declaration was the thing standing between a React Native application and the
storage layer. `check:runtime` refused to widen it, correctly: six files reached
for `localStorage`, `caches` or IndexedDB without asking first.

**The three lazy defaults now ask, and refuse with a sentence.** `LankaStorage`
and `LankaEncryptedStorage` build a browser adapter only when the application
handed them no handler for that space. On a page that is right; off one it
produced `ReferenceError: localStorage is not defined`, thrown from inside a
getter nobody called by name. They now feature-detect and throw a message naming
the fix — pass a handler, `createLankaMmkvAdapter(engine)` on a device,
`createLankaUnstorageAdapter(storage)` on a server.

**Not a fallback.** A storage that silently became a `Map` would lose what it was
told to keep at the next reload, which is worse than not starting.

**The Cache Storage adapter asks in its constructor**, which is where the answer
is needed, and the Cache Storage polyfill now checks `localStorage` as well as
`window` — a page whose storage is unavailable has nowhere to put what the
polyfill would hold, and installing over that answers reads with values it never
stored.

**The blob adapter never needed a DOM at runtime.** Its factory is a constructor
parameter and its type annotations erase; the two names it carried — `IDBFactory`
and `IDBDatabase` — said otherwise to a gate that reads source. They are derived
from a type it still names (`IDBOpenDBRequest["result"]` IS `IDBDatabase`), so
the compiler knows exactly as much as before and the file no longer claims
something it does not use.

Encryption is unchanged and still detects WebCrypto: on a runtime without it,
`LankaEncryptedStateStorage` reads nothing rather than falling back to plaintext.
On a device the engine encrypts instead — MMKV with a key, a keychain by being
one.

The playground takes the browser globals away and runs an ordinary session over
an injected engine, which is what makes "universal" an assertion rather than a
declaration.
