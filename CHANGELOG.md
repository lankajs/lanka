# Changelog

Nothing has been released. Every package is at `0.0.0`, nobody has any version of
anything installed, and this file stays empty until that changes.

That is not a formality. A changelog exists to tell somebody what breaks in code
they already have — and until the first publish, renaming an export costs a diff
rather than a migration. What the file held before this line was a list of
changes against a predecessor nobody consumed, which is a release note for a
release that did not happen.

`skills/surface/SKILL.md` §2 is what makes the difference permanent: after the
first publish a facade name is never removed. Every name is worth arguing about
now, and free to change until then.

## What the first entry will carry

Packages are versioned independently, and from the first release each gets its
own `CHANGELOG.md`. This file then keeps only what spans them.

The release publishes the packages, their reports in [`api/`](./api) and their
changelogs together — [`CONTRIBUTING.md`](./CONTRIBUTING.md#releasing) is the
sequence.
