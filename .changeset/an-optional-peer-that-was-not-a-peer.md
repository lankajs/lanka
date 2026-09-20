---
"@lankajs/react": patch
"@lankajs/vue": patch
"@lankajs/svelte": patch
"@lankajs/solid": patch
"@lankajs/angular": patch
---

`@lankajs/<framework>/testing` shipped a copy of its testing library, and React's
copy did not run.

`import { renderWithLanka } from "@lankajs/react/testing"` — the line the 2.0
migration asks every React consumer to write — threw
`Error: Dynamic require of "react" is not supported` from the installed package,
before any test of theirs ran. The other four members shipped the same way and
were merely large: `dist/testing.js` was 45,701 lines in React and 84,178 in Vue,
against 93 and 52 for the barrel beside it.

## What happened

All five declared their testing library in `peerDependenciesMeta` and in no
`peerDependencies`. npm reads that meta as a MODIFIER, so a name with no peer of
the same name modifies nothing and is ignored — the quiet half. The loud half is
the build: tsup externalises `dependencies` and `peerDependencies` and nothing
else, so the library was bundled INTO the package that meant to borrow it from
the consumer. What React inlined was CJS reaching `react` through a dynamic
`require`, which esbuild's ESM shim answers by throwing.

`@lankajs/tool-di` had it right all along — `vite` in both places — which is what
makes this a rule rather than a preference. `scripts/scaffold.mjs` now refuses a
`peerOptional` naming something absent from `peer`, and says what shipped when it
was missing.

## Why nothing caught it

Two blind spots, both now closed.

`scripts/verify-build.mjs` is the one place tarballs are installed and imported,
and it never asked for this entry: every suite in this repository reaches
`renderWithLanka` by its relative path. It checks the subpath now.

It also was not building these packages. Its build step filtered `./modules/*`,
which is one level deep — it selected the seven modules at the top of `modules/`
and none of the eighteen below, the whole `bindings/` shelf among them. Their
tarballs were packed from whatever `dist` a previous run had left, which is the
stale-directory failure the file's own first section exists to prevent. The set
built is now derived from the same registry as the set packed.
