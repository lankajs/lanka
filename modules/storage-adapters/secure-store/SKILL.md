# Maintaining `@lankajs/secure-store`

The longest member of its family, and every extra line is a clause the engine
cannot keep by itself. If this package ever gets shorter, check which promise
was dropped.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/storage` for types and **nothing else**. `expo-secure-store`
  is a peer dependency and is never imported.
- A member of `modules/storage-adapters/`, so its surface differs from its
  siblings' in exactly one place: the vendor's name. The key codec is internal
  and must stay that way — exporting it would put a name on the shelf that no
  sibling has.

## Invariants

1. **Every caller row carries `ROW_PREFIX`, and the index does not.** Without it
   an application writing `lanka.secure-store.index` overwrites the index with an
   ordinary value and every secret before it survives the next sign-out, in
   silence. The prefix does not defend against the collision — it makes it
   unexpressible, which is the only version of that fix worth having.

2. **Writes go through the queue, and the index is written first.** Read-modify-
   write cannot overlap safely, and `Promise.all([setItem, setItem])` is what an
   application writes without thinking. Between the two writes the surviving
   failure must be a name with no row, never a row with no name.

3. **The index is the only reason `clear()` is true.** The keychain cannot be
   enumerated, so what this adapter wrote is what this adapter remembers. Every
   write and every removal keeps it current, and `clear()` walks it before
   deleting itself. Caching it in memory would break a second adapter over the
   same keychain; on a device there is one process, and that is the trade written
   down in the class.

4. **A damaged index is empty, never a throw.** Anything can be sitting under
   that key: an earlier version, another library, a write the process died
   halfway through. A session that cannot sign out is worse than one that forgets
   a row.

5. **Keys are encoded, and the encoding escapes itself.** `_` is legal in a
   keychain key, so it must escape itself or a literal underscore decodes as
   whatever followed it. Every escape is exactly five characters so the decoder
   never guesses where one ends. `encodeURIComponent` is not an option: `%` is
   refused too.

6. **The ceiling refuses; it does not split.** Splitting a value across rows
   would make this a filesystem with a keychain underneath, and it hides a worse
   failure than it prevents — half a token read back as a whole one.

7. **No encryption, and say why.** The keychain is ciphertext at rest already.

8. **No options passthrough.** `keychainService`, access groups and prompts are
   per-call options this package cannot test on a device it does not have. An
   application that needs them wraps the engine before handing it over.

## The playground

The keychain double REFUSES an unsafe key, exactly as the library does, and does
NOT enforce the value ceiling — because the platform truncates rather than
refusing, and a double that threw would make the adapter's own guard untestable.
Both halves of that are load-bearing.

## What to run

```sh
pnpm --filter @lankajs/secure-store test
pnpm check
```

The conformance suite is called with `maxValueBytes: 2048`, which is what turns
clause 10 around: a refusal one byte over, and a round trip exactly at the line.
This is the only member of the four that answers it that way.
