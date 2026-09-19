# @lankajs/storage

## 2.1.1

### Patch Changes

- Updated dependencies [4178c0c]
- Updated dependencies [8349d0b]
- Updated dependencies [9ae4f10]
- Updated dependencies [d0e4474]
- Updated dependencies [912c1c1]
- Updated dependencies [efaaf46]
    - lanka@2.0.0

## 2.1.0

### Minor Changes

- afcdfd9: `@lankajs/storage` runs where the framework does: browser, node, native

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

### Patch Changes

- 252a40f: The storage port moves into core, and gains a suite that can fail

    `ILankaStorageAdapter` and its two halves are now declared in `lanka/storage` —
    types only, zero runtime, called by nothing inside core, exactly as `lanka/cache`
    is. `@lankajs/storage` re-exports all three names, so an application importing
    them from there keeps working and always will.

    **Why the port moved, when the module owns every implementation.** A family of
    adapters promises interchangeability, and the only honest way to check that
    promise is a shared conformance suite — which lives in `@lankajs/tool-testing`.
    The kit depends on `lanka` and on nothing else, and its own notes said so: a
    double over a MODULE's port would invert the direction the whole repository
    points. So the suite was impossible while the port sat in a module, and a family
    with no suite is packages promising interchangeability with nothing checking it.

    The alternative — amending the structure canon from "the same core port" to "the
    same port" — was rejected. It would have been one sentence instead of a
    subsystem, but the kit's objection is not about the canon's wording and no
    wording fixes it.

    **`@lankajs/tool-testing` gains `lankaStorageAdapterConformance`**: ten clauses
    as DATA, so the suite's own spec can point each scene at an adapter that is
    broken on purpose and assert that the scene fails. Twelve such adapters are in
    that spec, and every one of them is a bug somebody has shipped — an engine that
    parses JSON on the way out, a `clear` that empties its key index and leaves the
    values, a ceiling that truncates instead of refusing. It also gains
    `createLankaFakeStorageAdapter`, the port's second implementation: an interface
    with one implementation is not an abstraction.

    **One clause is deliberately the opposite of the read cache's.** `cancel` on
    `ILankaReadCache` is optional because three of four libraries could not do it,
    and a cache that cannot cancel merely finishes a request nobody wants. `clear()`
    stays REQUIRED here, because a store that cannot clear ends a session with the
    tokens still in it — waste versus the failure itself. An engine that can neither
    enumerate nor wipe, which is `expo-secure-store`, keeps its own index instead;
    the cost lands on the one adapter with the problem rather than on every caller.

    **What the suite found when it was pointed at what already exists.** No broken
    clause: `LankaWebStorageAdapter`, `LankaCacheStorageAdapter` and the playground's
    own memory adapter pass all ten. Two wrong documents: `LankaIndexedDbAdapter`
    does not bind this port at all — it holds `Blob`s for `@lankajs/blob-cache`,
    which its own file header states in its first paragraph — while its class
    docblock and the package README both called it a third handler of the same port.
    Both now say what the code does. Nothing moved in the code.

- 753958f: The storage-adapter family: four engines behind one port

    `modules/storage-adapters/` is a shelf, and it holds one package per storage
    engine. Each takes its engine as a PARAMETER and imports the vendor nowhere — the
    shape `new LankaWebStorageAdapter(localStorage)` has had since the beginning. A
    native module cannot run in node, so an adapter that reached for the library
    itself could only be tested by the application that shipped it.

    All four answer `lankaStorageAdapterConformance` — eleven clauses, twenty-one
    scenes — and their surfaces differ in exactly one place: the vendor's name.

    **`@lankajs/mmkv`** is the one to take first on a device, and the only engine
    that fills the SYNCHRONOUS half: a store read during the first render either has
    its value or renders twice. It supports both majors and tells them apart by
    SHAPE — v4 renamed `.delete()` to `.remove()`, and `package.json` says what the
    consumer wrote while the instance says what they got. An instance with neither
    throws and names both spellings, because a sign-out that removes nothing and
    reports success is the failure worth being loud about.

    **`@lankajs/react-native-async-storage`** is the engine an existing application
    already has. It declares no synchronous half — nothing crossing the bridge
    answers before the next tick — and it copies the library's frozen key array, so
    an ordinary `keys.sort()` does not throw at a caller who never saw where the
    array came from. Its name is long on purpose: `LankaAsyncStorageAdapter` beside
    the port's own `ILankaAsyncStorageAdapter` would read as that interface's
    implementation.

    **`@lankajs/secure-store`** is the one that bends the port, and the longest for
    that reason. `expo-secure-store` publishes three calls — read, write, delete — and
    a sign-out needs two more. So it keeps an index of what it wrote and walks it on
    `clear()`, answers `keys()` from that index, encodes keys the keychain would
    refuse and decodes them on the way out, and refuses a value above roughly two
    kilobytes rather than letting the platform truncate one. Truncation is the worst
    available failure: half a token reads back as a whole one.

    Four guarantees the members carry that a first reading of the port does not ask
    for, every one of them found by writing the scenario rather than the unit:

    - **`@lankajs/secure-store` serialises its writes.** Read-modify-write over the
      index is not safe to overlap, and overlapping is ordinary — an application
      storing an access token and a refresh token writes `Promise.all([...])` without
      a second thought. Both calls read the same index and the second publishes it
      without the first, so `keys()` forgets a key and `clear()` leaves that secret
      on the device under a name nobody will think to look for. The index is also
      written BEFORE the value: between the two writes anything can happen, and a
      name with no row reads as a missing key while a row with no name outlives every
      sign-out.
    - **`@lankajs/secure-store` keeps its index out of reach.** Every caller row
      carries a prefix and the index does not, because `lanka.secure-store.index` is
      a legal key an application is entitled to write — and writing it used to
      replace the index with an ordinary value, leaving every secret stored before
      that moment invisible to `clear()` while the sign-out reported success.
    - **`@lankajs/unstorage` refuses a row it did not write, by name.** unstorage own
      `setItem` serialises, so a store shared with direct calls holds objects and
      numbers; there is no honest string to make from one, and a `TypeError` out of a
      decoder the caller never invoked is not an answer.
    - **`@lankajs/mmkv` rejects where the engine throws.** MMKV refuses
      synchronously — a full disk, a key that no longer opens the file — and a method
      promising a `Promise` must hand that over the way it promised.
      `adapter.setItem(...).catch(...)` and `Promise.all([...])` both break on a
      synchronous throw, and the second breaks before the array is built.

    **`@lankajs/unstorage`** brings twenty-odd drivers — a filesystem, a Redis, a
    Cloudflare KV, an SQL table, one you wrote — and is the only member that runs on
    a server. Two things it does that the library does not:

    - **the raw pair.** `getItem` deserialises, so a stored `"null"` comes back as
      `null`. Clause 1 of the port says a value returns byte for byte;
    - **keys as written.** Measured over every ASCII punctuation mark against 1.17.5:
      `/` and `\` become `:`, `?` drops the rest of the key, and `a::b` and `a:b` are
      ONE row — so two keys an application means to keep apart silently merge. Those
      characters are escaped and decoded; everything else, including dots, spaces and
      underscores, passes through untouched.

    Its tests drive the REAL library rather than a double, and its codec's spec
    re-takes that measurement on every run, so the table cannot go stale without
    something going red.

    `@lankajs/storage` gained `native` in the change that follows this one: its
    browser defaults now ask before they require, and refuse with a sentence naming
    which adapter to pass. Until that landed, these four adapters existed and the
    facade that takes them declared itself browser-only.

- Updated dependencies [937cf2f]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [252a40f]
- Updated dependencies [937cf2f]
- Updated dependencies [0453484]
- Updated dependencies [937cf2f]
    - lanka@1.3.0

## 2.0.0

### Major Changes

- 3331c47: Four more promises the code did not keep. Each is pinned by a test that fails on
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

### Patch Changes

- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
    - lanka@1.1.0

## 1.0.0

### Major Changes

- The first release: nineteen packages, one framework.

    `lanka` is the core — bootstrap, config, role, locator, gateway, validation,
    mock, errors, scenario, viewmodel and logger. Nine `@lankajs/*` modules an
    application installs one at a time, five plugins that occupy a declared extension
    point, and four tools that run before runtime: the `@lanka_di` alias for six
    bundlers, the boundary lint rules, the test kit and the skill installer.

    The one rule everything follows from is checked rather than agreed: imports go
    one way, and `@lankajs/tool-eslint` names the file and the line when they do not.
    What every package promises is written down in `api/`, and from this version a
    name there is kept until a major.

    `1.0.0` rather than `0.1.0` says the five extension points have settled: request
    middleware, the in-flight counter, bus middleware, logger sinks, and `use()`
    itself. Three plugins occupy them between them, which is what made the shapes
    answerable rather than imagined.

### Patch Changes

- Updated dependencies
    - lanka@1.0.0
