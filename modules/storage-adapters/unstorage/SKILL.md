# Maintaining `@lankajs/unstorage`

The member with twenty engines behind it, and the only one whose tests drive a
real library.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/storage` for types and **nothing else** at runtime.
  `unstorage` is a peer dependency, and a dev dependency only because the tests
  drive it.
- A member of `modules/storage-adapters/`, so its surface differs from its
  siblings' in exactly one place: the vendor's name. The key codec is internal.

## Invariants

1. **The RAW pair, always.** `getItem`/`setItem` on unstorage deserialise. Clause
   1 of the port says a value returns byte for byte, and a stored `"null"` coming
   back as `null` is the failure that clause is written against.

2. **Escape what the library normalises, and nothing else.** `/`, `\`, `?` and
   `:` — measured, not assumed, and the measurement is re-taken by
   `driverKeyCodec.test.ts` on every run so the table cannot go stale. Escaping
   more would make ordinary keys unreadable in whatever the driver writes to;
   escaping less loses a key or merges two.

3. **The escape escapes itself.** `~` is legal in a key, so a literal one must be
   encoded or it decodes as whatever follows it.

4. **Bytes are decoded here; anything else is refused here.** A filesystem
   driver answers bytes to a raw read, and those are a raw read of a string.
   An object or a number is a value somebody wrote through unstorage's own
   serialising `setItem`, and there is no honest string to make from it — so the
   read fails with the key in the message. Handing either on would put a type the
   caller was never promised behind one that says `string`, and it would break at
   whatever read it first rather than here.

5. **The codec is NOT shared with `@lankajs/secure-store`.** Same shape,
   different alphabet, and a member may not depend on a sibling — swapping one
   for the other would install both. Twenty-five lines twice, each with its own
   measurement, is the cheaper of the two.

## The playground

No engine double: unstorage runs in node, so the scenes drive the real library
over its memory driver. That is deliberate and worth keeping — it makes the
scenes evidence about the LIBRARY, and it is what would catch a release that
changed how keys are normalised.

The unit spec beside the adapter covers what the memory driver cannot produce: a
raw read answering bytes, and a missing key answering `undefined`.

## Tests and coverage

Beside each unit, plus the playground scene in `_playground/`, which drives the
REAL library over its memory driver — evidence about the library, and what would
catch a release that changed how keys are normalised. The unit spec covers what
the memory driver cannot produce: a raw read answering bytes, and a missing key
answering `undefined`.

The port's own list is `lankaStorageAdapterConformance` from
`@lankajs/tool-testing`, and it is what `check:family` requires every member of
this shelf to run. A behaviour that belongs to the PORT is proved by adding a
scene there, where all four members answer it; only what is unstorage's belongs
in a test here.

Coverage is a ratchet: add the missing test, never lower a threshold.

## Before you finish

```bash
pnpm --filter @lankajs/unstorage test
pnpm --filter @lankajs/unstorage test:coverage
node scripts/check-api.mjs
node scripts/check-family.mjs
pnpm check
```

## Traps

**Using `getItem`/`setItem` instead of the raw pair.** unstorage deserialises,
so a stored `"null"` comes back as `null` and the port's promise of a string is
broken by one character in a method name.

**Escaping every key.** An ordinary key must be stored under its own spelling, or
a filesystem driver writes files nobody can read. Only what unstorage normalises
is escaped, and the table in the guide is the measured list.

**Swallowing a row this adapter did not write.** There is no honest string to
make from `{ a: 1 }`; the refusal names the key and what it found, which is what
tells a consumer they are mixing two APIs on one storage.

**A feature that would also make sense in another member.** It belongs to the
port, in `@lankajs/storage`, where all four get it.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
