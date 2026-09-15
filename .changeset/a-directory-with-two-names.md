---
"@lankajs/tool-di": minor
---

The barrel directory may be called `.lanka` or `.lanka_di`, and `lanka-di` moves between them

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
