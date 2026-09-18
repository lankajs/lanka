# Maintaining `@lankajs/tool-di`

The consumer-side wiring: the `@lanka_di` alias, the `.lanka_di/` scaffolder, and
the verifier that turns a runtime `undefined` into a build failure with a file
name in it.

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
   its own: TypeScript's wildcard `include` skips dot-directories, so
   `.lanka_di` compiles without types, silently, and the one file that wires the
   whole application is the one file with no types.

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

## Tests and coverage

Beside each unit, plus the `_playground/` scene, which runs the verifier over
fixture projects: healthy, missing, wrong, and mis-configured tsconfig.

Coverage is a ratchet: statements 98, branches 96, functions 94, lines 98.

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

**Making the plugin write anything at `buildEnd`.** Everything happens at
`buildStart`, before the graph exists, so a failure stops the build rather than
producing one.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
