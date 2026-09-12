# @lankajs/unstorage

**▸ module** · Twenty drivers as one storage engine

> The server, the edge, and every engine this repository has never heard of.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaUnstorageAdapter`, `createLankaUnstorageAdapter` — the port over any unstorage driver
- `ILankaUnstorageEngine` — the part of unstorage's surface this uses

## What this is for

The other three members are one engine each. This one is twenty-odd: a filesystem, a
Redis, a Cloudflare KV, a Vercel KV, a Netlify blob store, a Mongo, an SQL table, a
Capacitor preference store, the browser's own. An application whose engine this
repository has never heard of writes an unstorage driver and keeps the port.

It is also the member that makes `@lankajs/host/server` able to persist anything at
all: the other three are native modules.

## Raw in, raw out

unstorage deserialises by default — its `getItem` parses what looks like JSON, so a
stored `"null"` comes back as `null` and `"{}"` as an object. Clause 1 of the port
says a value returns byte for byte, so this adapter uses the raw pair. It is one
character in the method name and the whole difference between a string store and a
document store.

## The engine is handed in, never constructed

The adapter takes the engine as a parameter — the shape `new LankaWebStorageAdapter(localStorage)`
has had since the beginning — and imports the library nowhere. Three things follow, and the
third is the reason:

- the package has no runtime dependency on the vendor, so an application pays for what it
  installed and nothing else;
- a second instance with its own namespace is the application's to make, which is what a
  per-tenant store or a test that must not touch the page's keys needs;
- **it is testable off the device.** A native module cannot run in node, so an adapter that
  reached for the library itself could only be tested by the application that shipped it.
  The engine's surface is declared here as a type, and the conformance suite runs against a
  double of it — which is also what proves the declared shape is the shape the library has.

---

Repository map: [../../../README.md](../../../README.md)
