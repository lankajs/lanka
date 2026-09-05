---
"@lankajs/storage": major
"@lankajs/browser": major
"lanka": patch
---

Four more promises the code did not keep. Each is pinned by a test that fails on
the old code and passes on the new.

## `@lankajs/storage` — major, and why

**The storage key hash is keyed by the secret.** `LankaCipher` hashes a key NAME
because the name says what is stored under it. The hash was a plain SHA-256, and
a plain hash of a short predictable word is not a disguise — it is a lookup. The
dozen names an application actually uses fit in a dictionary anybody can build in
a second, and the common ones (`token`, `session`, `user`) are in published
rainbow tables already. `LankaEncryptor.hashKey` is now HMAC-SHA-256 keyed by the
secret, so the table has to be rebuilt by somebody who already has the secret —
and somebody who has the secret can read the values anyway.

**`clear()` removes what the cipher wrote, not the whole page.** It called the
adapter's own `clear()`, which for `localStorage` empties everything: the theme,
the language, the consent record, another library's data, and
`@lankajs/browser`'s release-guard version — so the next visit dropped every
cache as well. Entries now sit under a namespace and only those are removed. A
store that cannot list its keys (Cache Storage) still gets the old call, which
there means its own named cache and is already scoped.

`ILankaAsyncStorageAdapter` gains an OPTIONAL `keys()`, which is what makes the
scoped clear possible; `LankaWebStorageAdapter` implements it. An adapter a
consumer already wrote keeps compiling.

**Nothing you read is lost.** An entry written under the previous scheme is
carried over on the first read of that key — rewritten under the new name, the
old copy removed — and `clear()` sweeps the old shape as well. It is a major
because the on-disk format changed and a downgrade would not find the data, not
because a correct call breaks.

## `@lankajs/browser` — major

**`get` is the inverse of `set` again.** `set` takes `string | object` and writes
JSON for the object and the string itself for the string. `get` JSON-parsed
whatever it found, so a string that looks like a number came back as one:
`"1234567890123456789"` returned with its last digits rounded away, `"true"`
returned a boolean, and `"null"` returned `null` — which `get` uses for "no such
cookie", so `has()` reported an existing cookie as absent. Only a leading `{` or
`[` is parsed now, because those are the only shapes `set` ever writes. The
signature `get<T = string>` finally tells the truth.

Major because a consumer relying on the numeric auto-parse gets a string.

## `lanka` — patch

**`getEventLogs()` returns records in the order the bus saw them.** They are kept
per event TYPE, and the no-type call concatenated those lists — so `limit` took
the tail of whichever type the registry held last rather than the most recent
events. A debugging tool that reorders the evidence sends the reader after the
wrong cause. `ILankaEventLog` gains an optional `sequence`, which is what the
sort uses: a timestamp has millisecond resolution and a burst dispatches many
events inside one.
