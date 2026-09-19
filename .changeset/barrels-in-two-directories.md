---
"@lankajs/tool-di": minor
---

A project may keep its barrels in `.lanka` and `.lanka_di` at once, split however it likes

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
