<!-- Generated from modules/storage-adapters/unstorage/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/unstorage@1.0.1`** — this document describes that version.
>
> Install: `npm install @lankajs/unstorage unstorage zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/storage-adapters/unstorage/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/unstorage/_playground/playground.test.ts)

# @lankajs/unstorage — user guide

unstorage behind `ILankaStorageAdapter` — and with it a filesystem, a Redis, a
Cloudflare KV, a Vercel KV, a Netlify blob store, a Mongo, an SQL table, the
browser's own, or a driver you wrote.

## You will learn

- how to put unstorage, and with it twenty-odd drivers, behind the framework's storage port
- the two translations this adapter makes — raw values, and keys as you wrote them
- why this is the only member of the family that runs on a server, and the rule that comes with it
- how to test over the real library rather than a double

## When to reach for this

Reach for it on a server, in an edge runtime, or whenever the engine has to
be interchangeable — a filesystem in development, a Redis in production, memory
in a test. It is also the answer for a driver nobody here has heard of, including
one you wrote.

On a device the other three members are faster and closer to the platform. This
one is what makes work inside `@lankajs/host/server` able to persist anything at
all.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/unstorage unstorage zustand
```

> [!IMPORTANT]
> The engine is a peer dependency and this package never imports it — you build
> it and hand it in. `zustand` is `lanka`'s own peer: npm adds a missing peer
> for you and pnpm does not, so the line names all of them.

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

| written                                                   | answered by `getKeys()`                    |
| --------------------------------------------------------- | ------------------------------------------ |
| `a/b` and `a\b`                                           | `a:b`                                      |
| `a?b`                                                     | `a` — the rest is dropped                  |
| `a::b`                                                    | `a:b`, and it IS `a:b` — two keys, one row |
| everything else, including `%`, `#`, `_`, `.` and a space | unchanged                                  |

So those characters are escaped on the way in and decoded on the way out. An
ordinary key is untouched — `session.token` is stored under `session.token`, and
a filesystem driver writes a file you can read.

**Bytes become strings.** A raw read from a filesystem driver answers a `Buffer`;
the adapter decodes it, rather than handing a caller something that is not the
string its type promised.

**A row it did not write is refused by name.** unstorage's own `setItem`
serialises, so an application calling it directly beside this adapter leaves rows
holding objects and numbers. There is no honest string to make from `{ a: 1 }`,
so the read fails with a message naming the key and what it found — rather than a
`TypeError` out of a decoder you never invoked. If you see it, something is
mixing the two APIs on one storage.

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

| You need                                           | Install                               |
| -------------------------------------------------- | ------------------------------------- |
| a server, an edge runtime, or a driver of your own | `@lankajs/unstorage`                  |
| speed, and an answer on the first frame            | `@lankajs/mmkv`                       |
| a token behind the device's own lock               | `@lankajs/secure-store`               |
| the engine the app already has                     | `@lankajs/react-native-async-storage` |

## Recap

- Build the `createStorage` instance yourself, with whatever driver you mounted, and hand it in.
- Values go through `getItemRaw`/`setItemRaw`, so a stored `"null"` comes back as the string it was.
- Keys are escaped on the way in and decoded on the way out, because unstorage normalises separators — an ordinary key is untouched.
- A row written by unstorage's own `setItem` beside this adapter is refused by name rather than crashing in a decoder you never invoked.
- On a server the namespace is per request unless the store is genuinely shared; a module-level instance is one store for every reader.
- Test over the real library with the memory driver — better evidence than a double, and what this package's own playground does.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/unstorage/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/storage-adapters/unstorage/README.md) · Repository map: [../../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
