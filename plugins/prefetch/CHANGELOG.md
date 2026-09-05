# @lankajs/plugin-prefetch

## 2.0.2

### Patch Changes

- The shipped manifest and skill carry the package version. The 2.0.1 tarball was published without the scaffold pass, so its `plugin.json` and `skills/lanka-prefetch/*` still said 2.0.0. No code change.

## 2.0.1

### Patch Changes

- e53e03a: The chunk sweep's wire ceiling no longer applies to the pause and the visibility gate. `waitUntilAllowed` held all three under one `quietWireTimeoutMs` deadline, so a backgrounded WebView pulled the next chunk after the ceiling — the user's data plan spent on a screen nobody was looking at — and a pause was cut to whichever of `pauseExpiryMs` and `quietWireTimeoutMs` was shorter. A pause now waits for its own expiry; a hidden tab is waited for without a ceiling once the platform has reported itself visible (a platform that never did is still not believed); only the wire wait keeps the ceiling.

## 2.0.0

### Patch Changes

- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
    - lanka@1.1.0

## 1.0.1

### Patch Changes

- `@lanka_di/*` stays external in the bundle, which is what makes an installed package wirable at all.

    `1.0.0` shipped with those specifiers resolved at build time, so the repository's own empty fixture went into `dist`: an installed `lanka` resolved every gateway, scenario and singleton against `{}`, threw `not found` for all of them, and the consumer's `@lanka_di` alias had nothing left to attach to. Verified against the published tarball — `dist/index.js` contained no `@lanka_di` import at all. Left external, the specifier survives into `dist` and the `.d.ts`, and the consumer's bundler alias and `tsconfig` paths answer it.

    Four fixes ride along, each with the test that names it:

    - `register()` was honoured by two locators out of four, so a registration against the other two was accepted and ignored.
    - A lazy hook advertised `then`, which made it look like a promise to anything that duck-types one — `await` on a hook returned the hook.
    - A stopped event was still replayed to a later subscriber, because the buffer filled before the chain could refuse it.
    - `resolvePath` stripped a leading slash it had already returned for, and `findExportedClass` resolved names a barrel never exported.

    Only the packages whose published output actually changes are versioned here: the externalisation is declared for all nineteen, but the other fourteen never import `@lanka_di` and their bundles are byte-identical.

- Updated dependencies
    - lanka@1.0.1

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
