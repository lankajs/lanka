# Maintaining `@lankajs/mmkv`

A mapping from one library's five calls onto the storage port, plus the one
question that makes both majors work. Roughly eighty lines, and it should stay
that size.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/storage` for types and **nothing else**. `react-native-mmkv`
  is a peer dependency and is never imported — the engine is handed in.
- It is a member of the `modules/storage-adapters/` family. Its surface must
  differ from its siblings' in exactly one place: the vendor's name.

## Invariants

1. **The engine is a parameter, never a construction.** The moment this package
   calls `new MMKV()` it stops being testable off a device, an application loses
   the ability to keep two instances, and the vendor becomes a real dependency.

2. **The delete is asked of the instance, not of a version range.** v3 has
   `delete`, v4 has `remove`. `package.json` says what the consumer WROTE; the
   object says what they got. An instance with neither throws and names both
   spellings — a silent no-op there is a sign-out that reports success.

3. **`?? null`, never `|| null`.** MMKV answers `undefined` for a missing key and
   the port answers `null`; an empty string is a value and must survive the
   translation.

4. **Both halves over one store.** The asynchronous half is the synchronous one,
   through `settled` — not a second path. Clause 9 of the port is free here by
   construction, and it must stay free.

5. **A refusal from the engine travels as a rejection.** MMKV throws
   synchronously, and `Promise.resolve(this.setItemSync(...))` lets that throw
   out before the promise exists — so `setItem(...).catch(...)` has nothing to
   catch and `Promise.all([...])` breaks before the array is built. `settled` is
   a promise executor rather than an `async` method, because there is nothing
   here to await and the rejection must carry exactly what the engine threw.

6. **No encryption.** MMKV encrypts itself when given a key. Anything added here
   would be a second lock on one door, and the guide says so.

## The playground

Two engine shapes, one application. `createPlaygroundMmkv(3 | 4)` is the double,
and the conformance suite runs over BOTH — the older shape is what most
applications have installed, and a suite run only over the newer one would miss
the one difference this package absorbs.

## Tests and coverage

Beside each unit, plus the playground scene in `_playground/`, which runs the
whole application over both engine shapes.

The port's own list is `lankaStorageAdapterConformance` from
`@lankajs/tool-testing`, and it is what `check:family` requires every member of
this shelf to run. A behaviour that belongs to the PORT is proved by adding a
scene there, where all four members answer it; only what is MMKV's belongs in a
test here.

Coverage is at 100 on every axis and the threshold says so. There is no async
scheduling here for a run to differ on, so a number below it is a missing test
rather than a coin toss.

## Before you finish

```bash
pnpm --filter @lankajs/mmkv test
pnpm --filter @lankajs/mmkv test:coverage
node scripts/check-api.mjs
node scripts/check-family.mjs
pnpm check
```

## Traps

**Constructing the engine to save the caller a line.** It ends testability off a
device, and it ends an application's ability to keep two instances.

**Reading `package.json` to decide which delete to call.** The manifest says what
the consumer WROTE; the object says what they got. Ask the instance.

**Adding encryption "for safety".** MMKV encrypts itself when given a key, and a
second lock on one door costs a key derivation per read.

**A feature that would also make sense in another member.** It belongs to the
port, in `@lankajs/storage`, where all four get it.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
