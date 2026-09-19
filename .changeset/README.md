# Changesets

Thirty-nine packages — thirty-nine independent versions, and holding them by
hand is not possible: a package whose bump was forgotten goes to npm with the
old number and the new contents, and a consumer receives a change disguised as
the release they already have.

## How this is used

- `pnpm changeset` — describe the change: which packages it touches, and by how
  much (patch / minor / major). The file is committed with the edit, because the
  author of the edit is the only person who knows whether it breaks anything;
- `pnpm run version:packages` — fold the descriptions into versions and into
  every `CHANGELOG.md`.

Publishing is a separate step and a manual one; `CONTRIBUTING.md` §"Releasing"
owns it, and is not repeated here.

## What counts as a major

Anything after which a consumer's working code stops working: a name removed, an
argument's shape changed, a different default. Renaming a file inside a subsystem
is NOT a major — the barrels hide it — but removing a name FROM a barrel is.
