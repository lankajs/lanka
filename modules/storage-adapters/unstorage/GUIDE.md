# Using `@lankajs/unstorage`

unstorage behind `ILankaStorageAdapter` — and with it a filesystem, a Redis, a
Cloudflare KV, a Vercel KV, a Netlify blob store, a Mongo, an SQL table, the
browser's own, or a driver you wrote.

## Install

```sh
pnpm add @lankajs/unstorage unstorage
```

`unstorage` is a peer dependency and this package never imports it — the storage
instance, with whatever driver you mounted, is handed in.

## Wire it

```ts
import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import { LankaStorage } from "@lankajs/storage";
import { createLankaUnstorageAdapter } from "@lankajs/unstorage";

const engine = createStorage({ driver: fsDriver({ base: "./.data" }) });

export const appStorage = new LankaStorage({ local: createLankaUnstorageAdapter(engine) });
```

Swapping the driver — a Redis in production, memory in a test — changes this file
and nothing above it. That is what the port is for, one level further out than
usual: here even the ENGINE is interchangeable.

The class is there for a project that writes classes:

```ts
import { LankaUnstorageAdapter } from "@lankajs/unstorage";

const adapter = new LankaUnstorageAdapter(engine);
```

## What this package adds to the library

**Raw in, raw out.** unstorage's `getItem` deserialises: a stored `"null"` comes
back as `null`, a stored `"{}"` as an object. The port promises a string, so the
adapter uses `getItemRaw` and `setItemRaw`. One character in the method name, and
the whole difference between a string store and a document store.

**Keys as written.** unstorage's keys are paths, so it normalises separators.
Measured against 1.17.5 over every ASCII punctuation mark:

| written | answered by `getKeys()` |
| --- | --- |
| `a/b` and `a\b` | `a:b` |
| `a?b` | `a` — the rest is dropped |
| `a::b` | `a:b`, and it IS `a:b` — two keys, one row |
| everything else, including `%`, `#`, `_`, `.` and a space | unchanged |

So those characters are escaped on the way in and decoded on the way out. An
ordinary key is untouched — `session.token` is stored under `session.token`, and
a filesystem driver writes a file you can read.

**Bytes become strings.** A raw read from a filesystem driver answers a `Buffer`;
the adapter decodes it, rather than handing a caller something that is not the
string its type promised.

## On a server

This is the only member of its family that runs there — the other three are
native modules — so it is what makes work inside `@lankajs/host/server` able to
persist anything.

One rule comes with that: on a server the namespace is **per request** unless the
store is genuinely shared. A module-level instance is one store for every reader,
which is right for a cache and wrong for anything a user owns.

## Testing over it

unstorage runs in node, so test over the real library rather than a double:

```ts
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";

const adapter = createLankaUnstorageAdapter(createStorage({ driver: memoryDriver() }));
```

That is what this package's own playground does, and it is better evidence than
a double: it holds the shape declared in `ILankaUnstorageEngine` to the shape the
library actually has.

## Which member of the family

| You need | Install |
| --- | --- |
| a server, an edge runtime, or a driver of your own | `@lankajs/unstorage` |
| speed, and an answer on the first frame | `@lankajs/mmkv` |
| a token behind the device's own lock | `@lankajs/secure-store` |
| the engine the app already has | `@lankajs/react-native-async-storage` |
