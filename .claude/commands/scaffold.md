---
description: Change a package's generated files by editing the registry, then regenerate.
argument-hint: "<what should change, and in which package>"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

Generated-file work in **lanka**: `$ARGUMENTS`

## The rule

`scripts/registry.mjs` is the single declaration of every package. These files are
DERIVED from it and a direct edit does not survive the next run:

`package.json`, `tsconfig.json`, `tsup.config.ts`, `README.md`, `LICENSE`,
`CLAUDE.md`, `api/*.api.md`, `perf/*.perf.md`.

So: edit the registry (or the generator), then regenerate. Never the output.

## The loop

```bash
node scripts/scaffold.mjs           # regenerate everything from the registry
node scripts/check-scaffold-drift.mjs
pnpm install                        # if dependencies changed
pnpm check
```

`check:drift` is what catches a hand edit; it runs first in CI for that reason.

## Adding a dependency

A value imported at runtime must be a DIRECT dependency of the package that
imports it — declare it in the registry entry, not in the package.json. A
`import type` does not need one.

## Adding a package

The registry entry is the whole definition: name, kind, dependencies, the
devDependencies its tests and benches need. A bench that imports
`@lankajs/tool-testing/lankaBenchCalibration` without the devDep fails to resolve
and reports `NaN` — which reads as a very fast operation.

## Then

Commit the registry change and the regenerated output TOGETHER. A regeneration
committed apart from its cause is a diff nobody can review.
