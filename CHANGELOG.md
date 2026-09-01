# Changelog

Nineteen packages, versioned independently, each with its own `CHANGELOG.md`
beside its `package.json`. That is where a consumer looks: what changed in
`@lankajs/collection` is no business of somebody who installed `lanka` alone.

This file keeps only what spans them.

## 1.0.1 — the wiring, which 1.0.0 did not ship

Five packages, and one of them is the reason this release is an hour old rather
than a week: `lanka@1.0.0` bundled `@lanka_di/*` instead of leaving it external,
so the repository's own empty test fixture went out inside `dist`. An installed
core resolved every gateway, scenario and singleton against `{}` and threw
`not found` for all of them, and the alias a consumer points at their own barrels
had nothing left to attach to. The inversion `@lankajs/tool-di` exists for is the
framework's one inward direction, and the published artifact did not have it.

It is in the root changelog because it spans every package: the other eighteen
were correct and still useless without a core that can be wired.

Versioned: `lanka`, `@lankajs/tool-di`, `@lankajs/tool-eslint`,
`@lankajs/tool-testing`, `@lankajs/plugin-prefetch`. The other fourteen stay at
`1.0.0` on purpose — the externalisation is declared for all nineteen, but a
package that never imports `@lanka_di` builds byte-identical output, and a
version whose tarball is the same tarball teaches a consumer nothing.

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
