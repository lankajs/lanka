# Changelog

Nineteen packages, versioned independently, each with its own `CHANGELOG.md`
beside its `package.json`. That is where a consumer looks: what changed in
`@lankajs/collection` is no business of somebody who installed `lanka` alone.

This file keeps only what spans them.

## 1.0.0 — the first release

Every package went out together, because until this tag nobody had anything
installed and there was nothing to be compatible with. `1.0.0` rather than
`0.1.0` says the five extension points have settled — request middleware, the
in-flight counter, bus middleware, logger sinks, and `use()` itself — and three
plugins occupy them between them, which is what made the shapes answerable rather
than imagined.

From here the rule in `skills/surface/SKILL.md` §2 is in force: a name in
`api/*.api.md` is kept until a major version. Deletion is a decision and a major,
never a cleanup.

Published by hand, from a machine: `pnpm run release`, which runs the generated
output against the registry and then the whole gate chain before anything reaches
npm. No provenance attestation, because that signature comes from a CI runner and
cannot be added to a version afterwards — the trade is written down in
[CONTRIBUTING.md](./CONTRIBUTING.md#releasing).
