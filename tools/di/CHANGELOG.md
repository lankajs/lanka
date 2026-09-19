# @lankajs/tool-di

## 1.1.0

### Minor Changes

- d0e4474: The barrel directory may be called `.lanka` or `.lanka_di`, and `lanka-di` moves between them

    `.lanka` is what a new project now gets. `.lanka_di` is what earlier projects got
    and it keeps working — an alternative, not a deprecation: no warning, no tag, no
    end date.

    **Nothing moves on upgrade.** Every adapter resolves the directory from what is
    on disk, so a project that already has one keeps it; the default decides only a
    project that has neither. The `@lanka_di` alias is unchanged either way — it is
    written into the framework's own source and points at whichever directory the
    project uses.

    New in the package: `resolveLankaDiDir` answers where a given project's barrels
    are (`lankaDiContract.dirname` is the DEFAULT, not the answer), `migrateLankaDi`
    moves them, and every adapter takes an optional `dirname` to pin the choice
    rather than discover it. `ILankaDiReport` and `ILankaDiSetup` now carry
    `dirname`.

    A `lanka-di` command ships with the package:

    ```bash
    npx lanka-di where               # which directory this project uses
    npx lanka-di migrate --dry-run   # what moving would change
    npx lanka-di migrate             # to .lanka
    npx lanka-di migrate --to .lanka_di
    ```

    It renames the directory and rewrites the `@lanka_di/*` mapping and the `include`
    entry in every root `tsconfig*.json`. Those last two are why it is a command and
    not a note: neither fails when stale — TypeScript's wildcard `include` skips
    dot-directories, so a missed entry leaves the one file that wires the whole
    application with no types and no error.

    It refuses to merge. With both directories present it stops and says so, and so
    does the build-time check: the framework reads one and the other keeps
    type-checking, so a gateway added to the wrong file would never be seen and never
    reported.

    Three defects fixed along the way, all reachable before this release:

    - a file named `.lanka` or `.lanka_di` at the project root made the verifier skip
      creating the directory and then fail with a raw `ENOENT` naming a path inside
      that file. It now says the path is a file and names the other directory, which
      the framework reads just as well;
    - `lankaDiContract.dirnames` and `.barrels` were not frozen — `Object.freeze` is
      shallow — so any importer could push to the arrays every adapter reads;
    - `lanka-di migrate --to` with nothing after it fell back to the default and
      reported success. It now refuses.

- 0128952: A project may keep its barrels in `.lanka` and `.lanka_di` at once, split however it likes

    Both directory names were already legal; using both was reported as a mistake. It
    is now a layout, and the axis is the team's — by abstraction, keeping the
    gateways in one and the host in the other, or by shard, keeping half the gateways
    in each.

    One rule decides everything else: `@lanka_di/*` is an alias, an alias substitutes
    one path, so the primary directory answers for all six barrels and whatever the
    other holds arrives through a re-export in it.

    ```ts
    // .lanka/Gateways.ts — what @lanka_di/Gateways resolves to
    export * from "../.lanka_di/Gateways";
    export { BillingGateway } from "../src/Gateways/Billing/di";
    ```

    `verifyLankaDi` writes that file itself when the primary has none, carrying the
    re-export rather than the contract's stub — a stub there would shadow the real
    barrel with an empty one. When the consumer's own file is the one that would have
    to change, it reports the exact line and touches nothing.

    What it now refuses, and could not see before:

    - a barrel in the second directory that nothing re-exports — it type-checks,
      exports correctly, and is read by nobody;
    - a name exported by BOTH halves of a sharded barrel, which `export *` resolves
      by dropping, leaving the class in neither namespace with no error anywhere;
    - two copies of `Host.ts` or `Contract.ts`, which declare one value each and
      cannot be halves of anything;
    - a `tsconfig` whose `include` names only one of the two directories.

    `npx lanka-di where` now prints the layout barrel by barrel, and
    `npx lanka-di migrate` MERGES a two-directory project into one instead of
    refusing it — moving each barrel, dropping the re-export files that only pointed
    at them, and naming the barrels whose contents would have to be joined by hand.

    Two details worth knowing before you split:

    - **Write the re-export however your project writes an import.** Either quote
      style, and with the extension if your `moduleResolution` requires one —
      `"NodeNext"` makes `../.lanka_di/Gateways.js` the only form your compiler
      accepts. The check reads the path, not the formatting, and the forms it
      accepts only ever grow.
    - **A directory is not a layout; barrels are.** `resolveLankaDiDir` now ranks a
      directory that HOLDS a barrel above one that merely exists, so an empty
      `.lanka` beside a working `.lanka_di` no longer takes the alias.

    Nothing changes for a project using one directory: the alias it is handed, the
    files that are scaffolded and the checks that run are what they were.

- 8f6206a: Server rendering could not start: vite handed `lanka` to node, and node has never
  heard of the alias vite invented.

    `lankaDiVite` set the alias for vite. Vite externalises anything under
    `node_modules` for SSR, and an externalised module is loaded by NODE — so the
    framework's published code asked node for a barrel and got

    ```
    Cannot find package '@lanka_di/Singletons' imported from
    …/node_modules/lanka/dist/locator.js
    ```

    Every consumer rendering on a server — Astro, SvelteKit, Nuxt, React Router,
    TanStack Start — hit this, while the client half of the same application worked
    perfectly, which is most of what made it expensive to read.

    The `config` hook now returns a third field beside the alias:

    ```ts
    ssr: {
    	noExternal: ["lanka"];
    }
    ```

    Naming the framework as one to PROCESS keeps it inside vite, where the alias
    exists. It is the only package that needs naming — the modules and plugins reach
    your barrels through it. Your own `ssr.noExternal` is merged, not replaced, so an
    application that added `"lanka"` itself can drop the entry or keep it.

    New on the contract: `lankaDiContract.packageName` is `"lanka"`. Everything else
    this tool knows is said in terms of the alias, and the alias cannot express this
    one — it names what is imported, never who imports it, and a bundler being told
    which package to process needs the importer.

### Patch Changes

- 8f6206a: A relative `root` in your bundler config produced a relative alias, and a relative
  alias is not a path.

    `root: "app"` is an ordinary vite config, and every bundler resolves its root
    against the working directory before using it. `lankaDiSetup` normalised the
    separators and passed the relative form straight through, so the alias became
    `app/.lanka` — which vite reads as a bare specifier and looks for in
    `node_modules`. On a real dev server: HTTP 500, `Failed to resolve import
@lanka_di/Singletons`. After: 200.

    What hid it is that the other half still worked. The directory is found with
    `existsSync`, which resolves against the same working directory, so the barrels
    were scaffolded correctly and the plugin reported a healthy setup — only the
    alias was wrong, and only at import time.

    The root is now resolved in `lankaDiSetup`, so every adapter gets an absolute
    alias whether its root came from the bundler or from you.

- 8f6206a: `lankaDiMetro` filed the alias under a key Metro never asks for, so React Native
  consumers could not resolve a single barrel.

    The adapter wrote one `extraNodeModules` entry — `{ "@lanka_di": dir }` — the way
    every other adapter here writes an alias. Metro's map is keyed by PACKAGE NAME,
    and `metro-resolver` reads a specifier starting with `@` as a scope:
    `@lanka_di/Gateways` arrives as one package name with an empty subpath, never as
    `@lanka_di` plus `Gateways`. Nothing matched, and every consumer got

    ```
    Unable to resolve module @lanka_di/Gateways
    ```

    naming a specifier their config plainly contained.

    The adapter now registers one entry per barrel, named in full, and Metro adds the
    extension from `sourceExts` as it does for any other module. All six barrels were
    resolved through the real `metro-resolver` 0.83.3 from the config the adapter
    hands back. The bare `@lanka_di` entry stays beside the six: Metro ignores it, and
    a wrapper composing after this adapter reads it to find the directory.

    Nothing to change in your `metro.config.js`.

- 8f6206a: `lankaDiVite` gave vite the alias and stopped there, and vite's dependency
  optimizer then froze the application's own source into its cache.

    **Two symptoms, one cause, and nothing reported for either.** The optimizer
    pre-bundles what it finds under `node_modules` and follows aliases while it does,
    so it walked `lanka`'s dist out of `node_modules`, through `@lanka_di`, into the
    consuming application's source, and copied that source into
    `node_modules/.vite/deps`. The cache is keyed by the lockfile and by parts of the
    vite config — not by application source, and not by `.env.*` — so once app code
    was inside it, no edit invalidated it:

    - **the browser ran the copy taken on the day the cache was written.** Editing a
      singleton changed nothing and raised nothing; the only evidence is a stack
      frame naming `node_modules/.vite/deps/dist-*.js` where it should name `src/`;
    - **`import.meta.env.VITE_*` read that day's env.** A key added to `.env.local`
      afterwards arrived as `""`, which surfaces a long way from its cause.

    Reported as lankajs/lanka#6, on an app carrying 63 of its own files inside one
    pre-bundle.

    The vite adapter now returns `optimizeDeps.exclude` beside the alias it already
    returned, from the same `lankaDiSetup` call, so the two cannot name different
    things. It excludes the ALIAS and not `lanka`: an exclude entry matches as a
    prefix, so `@lanka_di` covers every barrel and every package that reads one,
    while `lanka` itself stays pre-bundled — which is what the optimizer is for.
    Your own `optimizeDeps.exclude` is merged, not replaced.

    **Nothing to clean up on upgrade.** Changing `optimizeDeps` changes the
    optimizer's hash, so a poisoned cache is discarded the next time the dev server
    starts, and the browser asks for new URLs. To confirm one existed:
    `grep -l "#region src/" node_modules/.vite/deps/*.js` — any match is your source,
    frozen. An application carrying the `optimizeDeps.exclude` workaround by hand can
    drop it.

    The other five bundlers need no equivalent, and three of them do cache to disk
    just as heavily: webpack's filesystem cache, Turbopack's and Metro's transform
    cache were each given the same test — build, edit a file the barrels export,
    build again in a fresh process with the cache kept — and all three served the new
    value, as do Rollup's `cache` and esbuild's incremental rebuild. Vite's
    dependency optimizer is the only one of the six that treats what it pre-bundled
    as immutable, because it is keyed by the lockfile rather than by the files it
    read.

- 8f6206a: `lankaDiWebpack` destroyed every alias a project had already declared, if it
  declared them as a list.

    `resolve.alias` is a map OR a list of `{ name, alias }` — both are webpack, and
    the plugin merged only the map. Spread over the list form, which is
    `{ "0": entry, "1": entry }` to the spread operator, each of your aliases came
    back named after its index and pointing at an object.

    Webpack does not complain about that. It fails later, resolving something this
    plugin never touched, and the alias named in the message is not the one that
    broke.

    Both shapes are now answered, and a list stays a list. If you moved your aliases
    to the map form to work around this, you can move them back.

## 1.0.2

### Patch Changes

- 656e3a5: The shipped skill and the guide state the bundling consequence of the `@lanka_di`
  inversion: the framework imports the consumer's barrels, so a manual chunk rule
  that captures `lanka` captures the application graph with it, and the chunks that
  graph needs import back — circular chunks whose evaluation order decides whether
  the application boots. With it, the rule a consumer needs before the first one
  bites: match a chunk rule against the package specifier, everything after the last
  `node_modules/`, never against the module id, which under pnpm carries the
  peer-resolved store directory and therefore the name of every peer.

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
