---
name: lanka-unstorage
description: Persist values through any unstorage driver in a lanka application — filesystem, Redis, Cloudflare KV, Vercel KV, SQL, or one you wrote. Use when storage is needed on a server or an edge runtime, when the engine is not a React Native module, or when reviewing code that imports `@lankajs/unstorage`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/unstorage
    version: "0.0.0"
---

# @lankajs/unstorage

unstorage behind `ILankaStorageAdapter`, with twenty-odd drivers behind it.
`reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

Take it when the engine is **not a device**: a server render, a queue worker, an
edge function, a CLI — or when the engine is one nobody here has heard of and you
would rather write a driver than an adapter.

On a device, take `@lankajs/mmkv` (speed, and the first frame),
`@lankajs/secure-store` (secrets) or `@lankajs/react-native-async-storage` (what
the app already has).

## Wiring it

```ts
import { createStorage } from "unstorage";
import redisDriver from "unstorage/drivers/redis";
import { LankaStorage } from "@lankajs/storage";
import { createLankaUnstorageAdapter } from "@lankajs/unstorage";

const engine = createStorage({ driver: redisDriver({ base: "app" }) });

export const appStorage = new LankaStorage({ local: createLankaUnstorageAdapter(engine) });
```

Changing the driver changes this file and nothing above it.

## What this package does that the library does not

- **Raw in, raw out.** unstorage's `getItem` parses JSON-looking values; this
  adapter uses the raw pair, so a stored `"null"` stays the string `"null"`.
- **Keys as written.** unstorage normalises `/`, `\` and `?`, and merges `a::b`
  with `a:b`. Those are escaped and decoded, so what you wrote is what `keys()`
  answers.
- **Bytes become strings.** A filesystem driver answers a raw read with a
  `Buffer`; the adapter decodes it.

## On a server, one rule comes with it

The namespace is **per request** unless the store is genuinely shared. A
module-level storage is one store for every reader at once — right for a cache,
wrong for anything a single user owns.

## Reviewing code that uses it

- `engine.getItem(...)` called directly beside the adapter — that is the
  deserialising one, and mixing the two means two meanings for one key.
- A storage built at module level and used for per-user data on a server.
- A test that doubles unstorage. It runs in node: use the real library with
  `unstorage/drivers/memory`.
- An assumption that a key with a slash in it comes back with a slash from
  `engine.getKeys()` — it does not, which is why the adapter is between them.

## If you write your own adapter

The port is `ILankaStorageAdapter` in `lanka/storage`, eleven clauses in its
docblock. Run `lankaStorageAdapterConformance` from `@lankajs/tool-testing`
against it — the same list every package in this family answers.
