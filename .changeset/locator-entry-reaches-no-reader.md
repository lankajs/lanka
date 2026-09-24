---
"lanka": patch
---

A consumer's singleton no longer meets an undefined `ALankaSingleton` when `lanka/locator` is the first lanka import.

`Class extends value undefined is not a constructor or null`, thrown from the
consumer's own `Singletons.ts` — on node, and under vitest in any spec that
imports a singleton module directly. An application whose first import is
`lanka` never saw it, and neither did the tarball probe, which imported `lanka`
first too.

## What happened

The facades `lankaSingletons` and `lankaSharedStores` re-exported their locator
classes for `lanka/extend` to publish. That put `LankaSingletonLocator` — the one
module that reads `@lanka_di/Singletons` — behind the `lanka/locator` entry, the
entry whose body defines `ALankaSingleton`. esbuild hoists every chunk import
above the body, so the barrel evaluated before `ALankaSingleton` existed. The
1.3.0 fix ordered the exports in `locator/index.ts` so the marker came first,
and a bundler nullifies that order: the chunk holding the reader is imported
before any line of the body runs.

`verify-build.mjs` §1b exists to refuse exactly this, and passed. esbuild pulls a
chunk in for its side effects as a BARE import — `import "./chunk-X.js";` — and
the graph reader matched only `from "…"`, so the reader was reached and never
counted.

## The fix

- **A facade imports nothing from a locator.** It reaches its locator through
  the active runtime, and `lanka/extend` publishes `LankaSingletonLocator` and
  `LankaSharedStoreLocator` from their own files. `lanka/locator` now imports
  two chunks — the proxy factory and the runtime accessor — and reaches no
  reader, whatever order esbuild gives them.
- **§1b counts bare imports.** `scripts/built-imports.mjs` is the reader, pure
  and pinned by a spec that hands it the 2.2.0 shape: a reader behind a bare
  import.
- **§3b runs the consumer's order.** Each of the four entries a consumer's class
  imports — `lanka/gateway`, `lanka/scenario`, `lanka/viewmodel`,
  `lanka/locator` — is imported FIRST in a node process, in front of the barrel
  whose class extends it. Pointed at the 2.2.0 layout, `lanka/locator` fails
  with the consumer's own error.

No published name changes: `lanka/extend` still exports both locator classes,
and every export of `lanka/locator` is where it was.
