# Maintaining `@lankajs/tool-di`

The consumer-side wiring: the `@lanka_di` alias, the barrel scaffolder, and the
verifier that turns a runtime `undefined` into a build failure with a file name
in it.

## Boundary

- A **tool**: build configuration, not runtime. Nothing here ships in an
  application bundle.
- It knows the contract and the file system. It does not know what a gateway or a
  scenario _is_ — only that a barrel must export certain names.

## Invariants

1. **`lankaDiContract` is the single declaration.** The plugin verifies against
   it, the scaffolder writes from it, and its spec asserts both. Another barrel
   is one entry there, never an edit in three places that can disagree.

2. **The contract is frozen and versioned.** Bump `VERSION` when what the
   framework _expects_ of the barrels changes — a new required export, a
   different shape, a different file set. Not for framework-internal edits the
   barrels never see. The version exists for the published case: "file present,
   export present, different semantics" is the most expensive failure this tool
   can allow.

3. **A missing file is scaffolded; a wrong file is reported.** Overwriting a
   consumer's own code to satisfy a contract destroys their work. The two lists
   in `ILankaDiReport` — `created` and `problems` — keep the distinction visible.

3a. **What is written is inert, or derived from a layout the consumer has
demonstrably chosen.** Everything scaffolded used to be inert — `export {}` and
a doc comment — so the rule above was the whole story. A BRIDGE is not inert: it
is a wiring decision, and the evidence for it had better be a barrel somebody
put in the other directory and not a folder that happens to exist. That is why
`resolveLankaDiDir` ranks by contents rather than by existence: ranking by
existence let an empty `.lanka` beside a working `.lanka_di` take the alias and
rewrite six files of somebody's wiring on the strength of a coincidence.

3b. **Running twice says what running once said.** This package both writes and
judges, and the plugin calls it at `buildStart` — so a file it creates on the
first run is a file it reads on the second. A rule that cannot tell what a
consumer wrote from what this wrote condemns its own output on every build
after the first. It has happened once: `checkShard` counted FILES for a barrel
with a required export, so the bridge written for a host living next door was
reported as a second host, with "keep one" pointing at the file that held the
real one. Every scene in `verifyLankaDi.shards.test.ts` that exercises writing
calls the function twice, for that reason.

4. **Scaffolded barrels are legal while empty.** That is what lets a new project
   boot before it has its first gateway. A required export on a namespace barrel
   would break that.

5. **The tsconfig check is LINE-oriented.** A block-comment regex is wrong here:
   the strings inspected are globs, and a recursive include pattern contains a
   slash-star and a star-slash in the middle — a block regex eats the middle of
   every include and reports it as missing. A commented-out entry always occupies
   its own line in a formatted tsconfig, which is the only case that has to be
   understood.

6. **The tsconfig check is not optional politeness.** Neither omission fails on
   its own: TypeScript's wildcard `include` skips dot-directories, so the
   barrels compile without types, silently, and the one file that wires the
   whole application is the one file with no types.

6a. **It matches the directory name with a BOUNDARY, never as a substring.**
`.lanka` is a prefix of `.lanka_di`. An `includes` check passes a `.lanka`
project whose include still says `.lanka_di/**/*` — which is exactly the
project that just migrated, and exactly the state rule 6 exists to catch.

6b. **The directory is resolved, never assumed.** `.lanka` and `.lanka_di` are
both legal and neither is deprecated, so nothing may read
`lankaDiContract.dirname` to find a given project's barrels — that field is
the DEFAULT, for a project that has neither. `resolveLankaDiDir` looks, and
what a project HAS always beats what the preference order would rather it
had. Reversing that would scaffold an empty `.lanka` beside a working
`.lanka_di` and start the application against the empty one, with no error
anywhere, because both directories type-check.

6c. **Both directories present is a LAYOUT, not a fault.** A project may split
its wiring by abstraction or shard one barrel across the pair, and the axis is
the team's — nothing here may read one, prefer one, or nag about one. What is
enforced is the single fact an alias imposes: `@lanka_di/*` substitutes ONE
path, so the primary directory answers for all six barrels, and whatever the
other holds reaches the framework through a re-export in it. `resolveLankaDiShards`
reads that arrangement; `verifyLankaDi` reports a shard nothing re-exports,
because that shard is invisible to the framework and to every other check in a
build.

6e. **A shard is written, a consumer's file never is.** A barrel missing from the
primary while the other directory holds it is CREATED, carrying the re-export
rather than the contract's stub — a stub there would shadow the real barrel with
an empty one. A barrel the consumer already wrote is reported with the line to
add and left untouched, which is rule 3 unchanged.

6f. **Only a namespace barrel may be SPLIT; every barrel may live in either
directory.** The distinction is the one that took two attempts. `Host.ts` and
`Contract.ts` declare one value each, so they may sit in the secondary with a
bridge in the primary — that is "the gateways over there, the host over here" —
but they may not have a declaration on both sides, because there is no union of
two hosts. So `checkRequiredExport` counts DECLARATIONS and never files: two
files is the ordinary shape of this layout, and the second one is the line that
reaches the first.

6g. **A name exported by both halves is a problem of its own.** `export *`
resolves an ambiguous name by dropping it, so the name is in neither namespace
with no error anywhere. `lankaDiExportedNames` exists for exactly that
comparison, and it drops comments first — every namespace stub carries
`@example export { UserGateway } …` inside its doc comment, so a reader that
counted it would report every untouched project as colliding.

6h. **The bridge's recogniser is wider than its writer, and only ever grows.**
`lankaDiBridge` emits one form; `resolveLankaDiShards` accepts a set — either
quote style, with or without an extension, because `"moduleResolution":
"NodeNext"` makes the extension mandatory and the extensionless form a compile
error. The line lives in a CONSUMER's repository, so narrowing what is
recognised tells every project that already wrote one that its shard is
unreachable, on a minor. Add forms; never remove one — which is why a form is
admitted only if it can be a WORKING bridge. A backtick was accepted for an hour
before release and taken back: a module specifier must be a string literal, so
`export * from` with one is a syntax error, and the only thing that spelling can
really be is a dynamic `import()` of the shard — read as a bridge, it blesses
the exact silent failure the check exists for.

6i. **The recogniser matches the specifier, not the statement, and that has a
known cost.** `export type * from "…"` reads as a bridge: it type-checks, emits
nothing, and leaves the locator empty at runtime — and it is what a "prefer
type-only exports" autofix would write. Refusing it means parsing the statement,
which buys this one case at the price of every formatting a re-export may
legally have. Chosen, not missed. Revisit it with a real report, not with a
tightened regex.

6d. **The repository's own fixture does not follow the default.**
`tools/testing/_fixtures/.lanka_di/` is named by twenty-five `vitest.config.ts`
files and by `tsconfig.base.json`. `sync-di-fixture.mjs` therefore takes the
path from `LANKA_DI_FIXTURE`, not from `lankaDiContract.dirname` — following
the default would write a SECOND fixture beside the one everything reads, and
the whole repository's tests would keep resolving the old one: green, and
stale.

7. **`exportsName` recognises every export form** — `export const/let/var/function/class`
   and a listed `export { … }`. A form it misses reports a healthy project as
   broken, which is worse than the failure it prevents.

8. **The alias is set in `config`, and the root is re-read in `configResolved`.**
   Vite resolves the root after `config` runs; taking it once from
   `process.cwd()` is wrong for every project whose root is not the cwd.

8a. **The vite adapter also says the alias to the DEPENDENCY OPTIMIZER.**
`optimizeDeps.exclude` carries `Object.keys(alias)`, and the list is derived
from the same `lankaDiSetup` call as the alias itself so the two cannot
disagree. Vite pre-bundles what is under `node_modules` and follows aliases
while it does, so without this it walks `lanka`'s dist out through
`@lanka_di` and copies the consumer's OWN SOURCE into
`node_modules/.vite/deps` — a cache keyed by the lockfile, not by application
source and not by `.env.*`. The result is a dev server running yesterday's
code and reading yesterday's `import.meta.env`, with nothing reported
anywhere; the only evidence is a stack frame naming `deps/` where it should
name `src/`. Reported as issue #6, on a real app, with 63 application files
inside one pre-bundle.

The ALIAS is excluded and `lanka` is not. An exclude entry matches as a
prefix, so `@lanka_di` covers every barrel and every package that reads one,
present or future, while `lanka` stays pre-bundled — which is what the
optimizer is for. Excluding `lanka` instead also works and costs the dev
server a module graph it does not need, to fix a problem `lanka` is not the
cause of.

No other adapter needs this, and that was measured rather than assumed — the
first draft of this rule said the others "have no equivalent cache", which is
false. Three of them cache to disk. Each was given the same test: build, edit
a file the barrels export, build again in a fresh process with the cache kept.

| bundler   | cache under test                       | served after the edit |
| --------- | -------------------------------------- | --------------------- |
| webpack   | `cache: { type: "filesystem" }`        | the new value         |
| Turbopack | `.next/cache/turbopack`, 110 MB        | the new value         |
| Metro     | `%TEMP%/metro-cache`                   | the new value         |
| rollup    | `cache` passed from the previous build | the new value         |
| esbuild   | `context.rebuild()`                    | the new value         |

Vite's dependency optimizer is the only one of the six keyed by the lockfile
rather than by the files it read, which is the whole of why this rule is
vite-only. Rule 9 is therefore not broken by a behaviour one bundler has: what
is shared is the alias, and the alias comes from `lankaDiSetup`.

8b. **The vite adapter also names the framework to the SSR build.**
`ssr.noExternal` carries `lankaDiContract.packageName`. Vite externalises
what is under `node_modules` for SSR, and an externalised module is loaded
by NODE — which has never heard of an alias vite invented, and answers
`Cannot find package '@lanka_di/Gateways'`. The client half of the same
application works, which is what makes it expensive to read. Measured
against a real `ssrLoadModule`: it fails with the plugin alone and succeeds
with `noExternal`.

This is the one place the tool names the framework's PACKAGE rather than its
alias, and it has to: the alias says what is imported, never who imports it.
One name and not a list — `lanka` is the only published package whose output
carries the alias, and everything else reaches the barrels through it. The
name lives on the contract, so rule 1 still holds.

9. **Every adapter is `lankaDiSetup` said in one bundler's vocabulary, and
   nothing more.** Six of them exist and none may hold logic of its own: the
   contract, the scaffolding and the verification are the root entry, so a
   seventh adapter is a few lines and a bug fixed once is fixed for all. When an
   adapter needs a behaviour, the behaviour belongs in `lankaDiSetup`.

10. **Turbopack and Metro verify at CONFIG time, not at build time.** Neither has
    a plugin API — what they have is a JavaScript config file — so the adapter
    is a function evaluated while that file is read. This is earlier than the
    others check, not later, and `console.warn` is the only channel a config file
    has.

11. **The Metro adapter MERGES `resolver.extraNodeModules`.** Expo's default
    config and every other wrapper in a React Native project write there too; a
    spread that replaced the map would break resolution for packages this
    adapter has never heard of. It also returns the caller's own config type, so
    composing it with `withNativeWind` does not decay the type halfway down the
    file.

11a. **The Metro adapter registers ONE ENTRY PER BARREL, not one alias.**
`extraNodeModules` is keyed by PACKAGE NAME, and `metro-resolver`'s
`parseBareSpecifier` reads a specifier starting with `@` as a scope:
`@lanka_di/Gateways` comes back as one package name with an empty subpath,
never as `@lanka_di` plus `Gateways`. A lone `@lanka_di` entry is therefore
filed under a key Metro never asks for — the alias does nothing at all, and
every React Native consumer gets "Unable to resolve module" naming a
specifier their config plainly contains. Measured against metro-resolver
0.83.3: `{ "@lanka_di": dir }` throws `FailedToResolveNameError`,
`{ "@lanka_di/Gateways": dir + "/Gateways" }` resolves to
`.lanka/Gateways.ts`. This is the one place where "the alias, in that
bundler's vocabulary" is not one entry, and rule 9 still holds: the list is
`lankaDiContract.barrels`, so a seventh barrel is still one edit there.

The bare `@lanka_di` key stays beside the six. Metro ignores it; a wrapper
composing after this one reads it to find the directory.

12. **The webpack adapter handles BOTH of webpack's alias forms.**
    `resolve.alias` is a map or a list of `{ name, alias }`, and the list is the
    one a spread destroys: `{ ...[entry] }` is `{ "0": entry }`, so every alias
    the project had comes back named after its index. Webpack does not complain
    — it fails later resolving something this plugin never touched, and the
    alias in the message is not the one that broke. `ILankaWebpackCompiler`
    describes the map, because that is what this adapter's consumers have had;
    the list is answered at runtime, in the one function that knows both shapes.

13. **`lankaDiSetup` makes the root ABSOLUTE before anything reads it.** A
    bundler's root may be relative — `root: "app"` is an ordinary vite config —
    and every bundler resolves it against the working directory before use.
    Passed through as written it produces a relative ALIAS, and a relative
    alias is not a path: `app/.lanka/Gateways` is a bare specifier, looked for
    in `node_modules` and not found. What hides it is that the directory check
    still passes, because `existsSync` resolves against the same working
    directory — the scaffolding is correct and only the alias is wrong, and
    only at import time. Measured on a real dev server before the fix: 500,
    "Failed to resolve import @lanka_di/Singletons".

    It follows that no spec here may hard-code a Windows path as an input.
    `resolve("C:\\projects\\app")` is `C:/projects/app` on windows and
    `<cwd>/C:/projects/app` on linux, and CI is ubuntu. Two specs did, and both
    now take a real absolute path from the platform running them.

## Tests and coverage

Beside each unit, plus the `_playground/` scene, which runs the verifier over
fixture projects: healthy, missing, wrong, and mis-configured tsconfig.

Coverage is a ratchet: statements 100, branches 98, functions 100, lines 100.

One branch is uncovered and stays so: the webpack adapter's
`failure instanceof Error` arm. Nothing here throws a non-Error, so no test takes
it honestly — and deleting it would hand webpack's callback an `undefined` on a
stray throw, which is a failed build reported as a passing one.

The scenes come in two kinds and both are load-bearing: a NEW project, which gets
the default, and one started with `{ dirname: ".lanka_di" }`, which is the
consumer who adopted the framework earlier and must not be able to tell that a
second layout was ever admitted.

The fixture projects are the test data that matters. Add a case there rather than
mocking the file system — the failures this tool prevents are all about what is
actually on disk.

## Before you finish

```bash
pnpm --filter @lankajs/tool-di test
pnpm --filter @lankajs/tool-di test:coverage
pnpm run sync:di-fixture   # the test kit's fixture is generated from these stubs
pnpm check
```

That last command matters: `@lankajs/tool-testing` ships a `.lanka_di` fixture
generated from these stubs, and every package's test run resolves `@lanka_di`
through it. A stub changed here and not synced makes the whole repository's tests
resolve yesterday's contract.

## Traps

**Changing a stub without bumping the version** when the framework's expectation
changed with it. The check then accepts barrels the framework misreads.

**Scaffolding in CI by default.** The option exists so a consumer can turn it
off; the default is on because a first local run should just work. Do not invert
either half.

**Reaching for a regex over the whole tsconfig.** See invariant 5. This has cost
a day once.

**Treating `.lanka_di` as legacy.** It is an alternative. No deprecation tag, no
warning, no migration nag, and no plan to remove it — a project on it is correct
and stays correct. The only thing the default does is decide a project that has
neither. Writing "deprecated" anywhere near it is the edit to refuse.

**Comparing directory names with `includes`.** See 6a. `.lanka` is a prefix of
`.lanka_di` and the check goes quiet for exactly the project that just moved.

**Asking `existsSync` where the question is "is this a directory".** `.lanka` is
a plausible name for a consumer's own config FILE. `existsSync` says yes to it,
the directory is never created, and the first barrel write fails with a raw
ENOENT naming a path INSIDE a file — the confusing failure this package exists to
replace, arriving from the package itself. Both the resolver and the verifier
call `statSync().isDirectory()`, and they have to agree.

**One `Object.freeze` on the contract.** It is SHALLOW, and `as const` is erased
at build: `dirnames` and `barrels` need their own. Otherwise they are globals any
importer can push to, and every reader obeys on its next run.

**Reading `argv[at + 1]` for an option's value.** Past the end of the arguments
that is `undefined`, which is indistinguishable from the flag being absent — so
`lanka-di migrate --to` silently migrates to the default and reports success.
`optionValue` answers `null` for "given with nothing after".

**Making the plugin write anything at `buildEnd`.** Everything happens at
`buildStart`, before the graph exists, so a failure stops the build rather than
producing one.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
