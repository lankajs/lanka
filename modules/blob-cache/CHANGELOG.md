# @lankajs/blob-cache

## 1.0.2

### Patch Changes

- `TLankaBlobCacheConfig` accepts a consumer's own store names and budgets.

    The type was `typeof LANKA_BLOB_CACHE_CONFIG`, and the constant was declared
    `as const` — so every scalar in the type was a LITERAL: `dbName` could only be
    `"lanka-blob-cache"`, `cacheStorageName` only `"lanka-blob-cache-v1"`,
    `hydrateLimit` only `80`. The constructor's `config?: TLankaBlobCacheConfig`
    therefore accepted exactly one value, the default, and the guide's own sentence
    — "everything application-specific — store names, blocked hosts — is overridden
    when the policy is created" — did not compile. The first application to try it
    had an IndexedDB under its own name, with every returning user's avatars in it,
    and no typed way to keep it.

    The type is now a widened, readonly shape, and the constant is annotated with it.
    No published name changes; a consumer that read a literal off the constant reads
    a `string` or `number` now, which is what it was always going to be at runtime.

## 1.0.1

### Patch Changes

- Updated dependencies [3331c47]
    - @lankajs/storage@2.0.0

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
    - @lankajs/storage@1.0.0
