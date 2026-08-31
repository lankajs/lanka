# lanka

A layered React application framework: **lankaGateways → ViewModels → Views**, scenarios
over an event bus, and a locator for dependency resolution.

*Lanka* is a link in a chain: the thing that means something only through what it
connects. That is the job description — a frame, not a building. It has no opinion about
routing or styling, and it ships no components.

## One rule

Imports go ONE way. A ViewModel may reach a gateway; a gateway does not know ViewModels
exist. Not a convention — it is checked, and a violation names the file and the line.

## Telling one from another

The first question when reading this repository is what a package IS. The answer is
visible twice: in the top-level folder and in the npm name. Either alone would be too
little — a file tree shows no names, a dependency list shows no folders.

| | Folder | npm name | Core dependency | How it is wired |
| --- | --- | --- | --- | --- |
| ◆ **core** | `core/` | `lanka` | — | `createLanka()` |
| ▸ **module** | `modules/<name>/` | `@lankajs/<name>` | normal or none | `import` |
| ⬡ **plugin** | `plugins/<name>/` | `@lankajs/plugin-<name>` | **always `peerDependencies`** | `lanka.use(...)` |
| ⚒ **tool** | `tools/<name>/` | `@lankajs/tool-<name>` | normal or none | build / lint / test config |

The module/plugin distinction is not about size or importance but about **who calls whom**:

- **A module** is called by the app: `app → module`. Core does not know it exists. Remove
  a module and core works the same.
- **A plugin** is called by core: `app → core → plugin`. For that, core must declare an
  extension point and support it forever. Remove a plugin and core works, without the
  advertised ability.

One test question: **does core need a hook for this to work?** No — module. Yes — plugin.
Hence the rule that matters most here: **if a thing can be a module, it must be a module**,
because every extension point is a promise for the lifetime of a major version.

### Why a plugin uses a peer dependency

A plugin plugs into THE SAME core instance the consumer created. A normal dependency would
give it its own copy of core — its own active instance, bus and locators; the plugin would
work and the app would not see the result.

The range is always `workspace:^`, and that is not style. pnpm substitutes it on pack as
`^0.1.0`, a range. `workspace:*` would become an EXACT version, and the plugin would demand
exactly the core version it was built against: any core update would break installation. Verified by reading the
tarball (`scripts/verify-build.mjs`), not the source manifest, and rejected by
`scripts/check-publishable.mjs`.

## ◆ Core

| Package | What |
| --- | --- |
| [`lanka`](./core) | Core |

## ▸ Module

| Package | What |
| --- | --- |
| [`@lankajs/storage`](./modules/storage) | Storage and encryption |
| [`@lankajs/async`](./modules/async) | Async primitives |
| [`@lankajs/host`](./modules/host) | Living inside another framework |
| [`@lankajs/optimistic`](./modules/optimistic) | Optimistic mutations |
| [`@lankajs/collection`](./modules/collection) | Lists a screen reads |
| [`@lankajs/blob-cache`](./modules/blob-cache) | Binary resource cache |
| [`@lankajs/browser`](./modules/browser) | Platform capabilities |
| [`@lankajs/zod`](./modules/zod) | zod conveniences |
| [`@lankajs/valibot`](./modules/valibot) | valibot conveniences |

## ⬡ Plugin

| Package | What |
| --- | --- |
| [`@lankajs/plugin-http`](./plugins/http) | Request policy |
| [`@lankajs/plugin-sse`](./plugins/sse) | Server-sent events as a source of change |
| [`@lankajs/plugin-prefetch`](./plugins/prefetch) | Network priority ladder |
| [`@lankajs/plugin-bootstrap-steps`](./plugins/bootstrap-steps) | Bootstrap pipeline with context |
| [`@lankajs/plugin-devtools`](./plugins/devtools) | Bus and transport inspector |

## ⚒ Tool

| Package | What |
| --- | --- |
| [`@lankajs/tool-di`](./tools/di) | The consumer contract |
| [`@lankajs/tool-eslint`](./tools/eslint) | Boundary rules |
| [`@lankajs/tool-testing`](./tools/testing) | Test kit |
| [`@lankajs/tool-skills`](./tools/skills) | Skill installer |

## Core layout

Flat by subsystem, with no intermediate `Layers/`. The property this buys: **folder =
subpath in `exports` = line in the core map.** Three lists that used to be reconciled by
hand became one.

```
core/src/
├── bootstrap/
├── role/
├── config/
├── locator/
├── gateway/
├── validation/
├── mock/
├── errors/
├── scenario/
├── viewmodel/
├── logger/
├── _extend/         published as `lanka/extend`
└── _internal/       published as `lanka/internal`
```

## What is promised

Everything is reachable. Only what is named is promised, and the tier is written in
the import path:

| Import | Holds | Breaks in |
| --- | --- | --- |
| `lanka`, `lanka/gateway`, … | the facade a normal application uses | a major — and a name here is never removed |
| `lanka/extend` | mechanism: registries, wiring, what a devtool or a competing implementation needs | a minor |
| `lanka/internal` | primitives, shared between packages | any release |

Reaching past the facade is therefore possible, deliberate, and visible in review —
rather than impossible, which only makes people fork the framework.

Every promise is written down: [`api/`](./api) holds one report per package, and
`pnpm check:api` fails when a barrel and its report disagree. How a version may
change, and why a superseded name keeps working instead of being deleted, are
[`skills/surface/SKILL.md`](./skills/surface/SKILL.md).

## Where to start

- **[`core/GUIDE.md`](./core/GUIDE.md)** — the framework, taught in order. One line
  starts an application; the rest is what to reach for and when.
- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — how applications on lanka are usually
  organised, with every recommendation labelled `Checked`, `Recommended` or `Taste`,
  so a reader always knows whether they are looking at a rule or an opinion.
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — working on the framework itself.

## Three documents per package

Every package answers three different questions in three files, so none of them
has to guess who its reader is:

| File | Answers | Written for |
| --- | --- | --- |
| `README.md` | what this is, and why it is shaped this way | anyone deciding whether to install it |
| `GUIDE.md` | how to use it, with examples | somebody building an application |
| `SKILL.md` | what may not change, and what to run before finishing | somebody changing the package |

A repository-wide rule lives in [`skills/`](./skills) instead, identically for all
nineteen packages. A rule true of one package only lives in that package's
`SKILL.md`.

## Skills for your coding agent

Every package ships a skill: what it is for, the shapes to write, and the
refusals — the things that look like a missing feature and are the feature. Two
ways to install one, and they are not equivalent:

```bash
# Claude Code, from this repository
/plugin marketplace add lankajs/lanka
/plugin install lanka-storage@lankajs

# or from the packages you already installed — the skill for THAT version
npx lanka-skills sync
```

Prefer the second where it works. A skill installed from git describes the main
branch; a skill installed from your `node_modules` describes the code you are
actually running.

Start with `lanka-packages`, which routes to the rest by problem.

## Generated files

Package manifests, tsconfigs and READMEs are generated from
[`scripts/registry.mjs`](./scripts/registry.mjs). Edit the registry, never the
output — `pnpm check:drift` fails when the two disagree.
